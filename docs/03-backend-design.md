# 像素英语小镇：后端统一设计文档

> 替代旧数据库设计与广场实时方案文档 `04-database-design.md`、`05-plaza-realtime-plan.md`。
> 所有命名、模型、Redis Key、事件类型以本文档为准。

---

## 1. 架构

```
浏览器
  ├── HTTP ──→ Next.js (页面 + API Routes)
  │              │
  │              ├── Prisma ──→ MySQL (所有业务真相)
  │              │
  │              └── ioredis ──→ Redis (排行榜缓存 / Pub/Sub / 广场临时在线状态)
  │
  └── Socket.IO ──→ Socket.IO 独立服务
                       │
                       ├── 通过 next-auth/jwt 验证 NextAuth JWT Cookie（共享 NEXTAUTH_SECRET）
                       ├── Redis（临时在线状态 / 跨进程广播）
                       └── 广播 plaza 房间事件
```

**关键原则：**

- MySQL 是唯一事实来源；Redis 只存可重建的临时数据
- 业务写入在 MySQL 事务内完成，提交后才发 Redis Pub/Sub
- "先写 MySQL，后发 Redis"：避免广播了但数据库没有记录
- Redis 或广播失败不回滚业务；客户端通过 `/api/plaza/snapshot` 恢复
- Socket.IO 服务与 Next.js 是两个独立进程，同机部署，Nginx 将 `/socket.io/` 反向代理到 Socket.IO 端口
- 浏览器始终以同域 `wss://{domain}/socket.io/` 建连，由反向代理转发到内部 `SOCKET_IO_PORT`；不在浏览器暴露内部端口
- 登录会话使用 NextAuth JWT 策略的 HttpOnly、Secure、SameSite Cookie，默认有效期为 30 天；Socket.IO 服务必须使用 `next-auth/jwt` 解码，不得自行按普通 JWT 解析或把令牌写入 `localStorage`

---

## 2. 数据库模型

### 2.1 已实现的表

```text
users                          user_progress                   articles
─────                          ─────────────                   ────────
id (cuid, PK)                  id (cuid, PK)                   id (art-xxx, PK)
email (unique)                 userId (unique → User)          date
password                       completedArticleIds (JSON) ⚠️   titleEn / titleZh
name                           totalDaysLearned                summaryEn / summaryZh
role (user/admin)              totalArticlesCompleted          content (JSON)
createdAt / updatedAt          currentStreak                   difficulty
                               longestStreak                   durationSeconds
user_ai_settings               beginnerCount                   audioUrl
───────────────                intermediateCount               wordTimestamps (JSON)
id (cuid, PK)                  advancedCount                   createdAt / updatedAt
userId (unique → User)         lastCompletedDate
provider                       activityLog (JSON)              article_id_sequences
selectedModel                  badges (JSON) ⚠️               ────────────────────
encryptedApiKey                createdAt / updatedAt           name (PK)
apiKeyLast4                                                   currentValue
createdAt / updatedAt                                         updatedAt
```

> ⚠️ `completedArticleIds` 和 `badges` 为 JSON 字段，缺少数据库级去重约束和关联查询能力，将被下方新表替代。

### 2.2 新表

#### ArticleCompletion（文章完成记录）

```prisma
model ArticleCompletion {
  id           String   @id @default(cuid())
  userId       String
  articleId    String
  learningDate String                     // Asia/Shanghai 日期，如 "2026-07-16"
  completedAt  DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  article      Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([userId, articleId])          // 防止同一文章重复计入
  @@index([learningDate, completedAt])   // 排行榜日榜查询
  @@index([userId, learningDate])        // 用户学习日历
  @@map("article_completions")
}
```

**替代 `UserProgress.completedArticleIds`（JSON 数组）。** 迁移时从 JSON 数组展开为行。

#### PlazaActivity（广场动态）

```prisma
model PlazaActivity {
  id        String   @id @default(cuid())
  userId    String
  type      PlazaActivityType             // 后端枚举，前端不可自定义
  content   String?  @db.VarChar(500)     // 服务端生成文案
  metadata  Json?                         // { articleId, articleTitle, badgeCode, badgeName }
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([userId, createdAt])
  @@map("plaza_activities")
}

enum PlazaActivityType {
  ENTER_PLAZA
  ARTICLE_COMPLETED
  BADGE_EARNED
}
```

- `ENTER_PLAZA`：用户进入广场（5 分钟冷却，防刷新刷屏）
- `ARTICLE_COMPLETED`：用户完成一篇文章
- `BADGE_EARNED`：用户获得新徽章
- `content` 由服务端按类型生成（如 `{username} 完成了一篇文章`），不接收用户输入
- `metadata` 保存结构化数据供前端富文本渲染

#### BadgeDefinition（徽章定义）

```prisma
model BadgeDefinition {
  code        String    @id              // "first_article"
  config      Json                       // { name, description, icon, rule }
  enabled     Boolean   @default(true)
  version     Int       @default(1)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  userBadges  UserBadge[]

  @@map("badge_definitions")
}
```

`config` JSON 结构：

```json
{
  "name": "初次启程",
  "description": "完成第一篇文章",
  "icon": "seedling",
  "rule": {
    "metric": "totalArticlesCompleted",
    "operator": ">=",
    "value": 1
  }
}
```

允许的 `metric`：`totalArticlesCompleted`、`currentStreak`、`longestStreak`、`completedByDifficulty`（搭配 `difficulty` 字段）。允许的 `operator`：`>=`、`=`。停用的徽章不再授予，已获得的不删除。

#### UserBadge（用户徽章）

```prisma
model UserBadge {
  id        String   @id @default(cuid())
  userId    String
  badgeCode String
  earnedAt  DateTime @default(now())
  snapshot  Json                       // 获得时的徽章名称、图标、描述快照

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge     BadgeDefinition  @relation(fields: [badgeCode], references: [code], onDelete: Cascade)

  @@unique([userId, badgeCode])       // 同一徽章不重复授予
  @@index([userId, earnedAt])
  @@map("user_badges")
}
```

**替代 `UserProgress.badges`（JSON 数组）。**

---

## 3. UserProgress 调整

迁移后 `UserProgress` 移除：

- `completedArticleIds`（JSON）→ 查询 `ArticleCompletion` 表
- `badges`（JSON）→ 查询 `UserBadge` 表

保留字段不变：`totalDaysLearned`、`totalArticlesCompleted`、`currentStreak`、`longestStreak`、`beginnerCount`、`intermediateCount`、`advancedCount`、`lastCompletedDate`、`activityLog`。

### 3.1 排行榜计算

- 今日学习榜：以 `ArticleCompletion.learningDate`（Asia/Shanghai）筛选当天记录，按完成文章数降序、最早完成时间升序。
- 连续学习榜：先按 `UserProgress.currentStreak`（连续学习天数）降序；同分时统计该用户当前连续周期内的 `ArticleCompletion` 数量降序，再按最近学习时间降序。连续周期的开始日期由 `lastCompletedDate - currentStreak + 1` 推导，不新增积分或可消费货币。
- MySQL 是两张榜单的计算依据。Redis 仅缓存已经排序的榜单 JSON；文章完成后使相应缓存失效或重建，不能把 Redis ZSet 作为榜单真相来源。

---

## 4. 完成文章的数据流

```
POST /api/progress/complete { articleId }
│
├─ 认证：requireAuth() 提取 userId
├─ 日期：Asia/Shanghai → learningDate
│
├─ prisma.$transaction(async (tx) => {
│    1. ArticleCompletion (userId, articleId, learningDate)
│       → 唯一约束冲突 → 409 "文章已完成"
│
│    2. UserProgress 更新
│       totalArticlesCompleted +1
│       totalDaysLearned 按 learningDate 去重
│       currentStreak 连续？+1 : 重置
│       longestStreak 取较大值
│       beginnerCount / intermediateCount / advancedCount +1
│       lastCompletedDate = learningDate
│       activityLog[learningDate] +1
│
│    3. 徽章计算（检查所有 enabled BadgeDefinition.rule）
│       满足 → INSERT UserBadge (userId, badgeCode, snapshot)
│            → INSERT PlazaActivity (type=BADGE_EARNED, metadata)
│
│    4. INSERT PlazaActivity
│       type=ARTICLE_COMPLETED
│       content="{username} 完成了一篇文章"
│       metadata={ articleId, articleTitle }
│  })
│
├── 事务提交成功
│
├── Redis INCR plaza:version → version
├── ioredis PUBLISH plaza:events { type, userId, content, version, ... }
│
└── 200 OK { updated, badges, activity }
```

**关键细节：**
- 事务内一次干完所有写入，原子保证
- 事务提交后才发 Redis，避免广播空记录
- Redis / 广播失败不回滚数据库
- `plaza:version` 只在事务提交后递增；快照和每一条增量事件均携带该版本，客户端据此忽略乱序旧事件
- Redis 重启后版本可能从较小值重新开始；客户端对显式请求的快照始终以服务端数据覆盖本地状态，不因版本较小而拒绝快照

---

## 5. 广场进入流程（Socket.IO）

```
浏览器 connect → Socket.IO 服务
│
├─ 携带 NextAuth Session Cookie（同域自动发送）
├─ Socket.IO 服务端使用 next-auth/jwt 解码 JWT（共享 NEXTAUTH_SECRET）
│
├─ 验证失败 → disconnect
├─ 验证成功 →
│    1. 通过 Redis Lua 脚本写入 plaza:presence（member={socketId}|{userId}，score=过期时间）
│       并清理已过期 socket，再返回按 userId 去重后的在线人数
│    2. socket.join('plaza')，向 plaza 广播 plaza:online-update
│
│    ┌─ 冷却检查 ──────────────────────
│    │ plaza:enter-cooldown:{userId}
│    │ 未处于冷却 → Socket.IO 以内部服务凭证调用 Next.js 的广场进入服务
│    │            → Next.js 创建 PlazaActivity(ENTER_PLAZA)
│    │            → 设冷却 5 分钟
│    │            → 事务提交后附带 version 发布 plaza:events → 广播给 plaza 房间
│    └──────────────────────────────────
│
│    3. 发送 socket.emit('plaza:snapshot', { onlineCount, recentActivities, leaderboard, version })
│
├─ Socket.IO 使用自身 ping/pong；服务端按连接状态每 30 秒续期该 socket 的 presence score 至未来 45 秒
├─ 断连：通过同一 Lua 脚本删除该 socket、清理过期 socket、重新计算去重在线人数后广播
│         同一用户的其它 socket 仍在时，用户继续计为在线
```

---

## 6. Redis 设计

| Key | 类型 | 用途 | 过期 |
|---|---|---|---|
| `plaza:presence` | ZSet | member=`{socketId}\|{userId}`，score=过期时间；Lua 脚本清理并按 userId 去重 | 每项 45s（服务端续期） |
| `plaza:enter-cooldown:{userId}` | String | 进入广场冷却 | 300s |
| `plaza:leaderboard:daily:{YYYY-MM-DD}` | String(JSON) | MySQL 计算并排序后的日榜缓存 | 86400s |
| `plaza:leaderboard:streak` | String(JSON) | MySQL 计算并排序后的连续学习榜缓存 | 3600s |
| `plaza:version` | String(Int) | 实时快照与事件的全局递增版本 | 无 TTL；Redis 重启后由权威快照重新校准客户端 |
| `plaza:events` | Pub/Sub Channel | Next.js → Socket.IO 事件 | 无 |

**Redis 不存：** 用户身份、JWT/Session、业务数据。

---

## 7. Socket.IO 事件

### 服务端 → 客户端

| 事件 | 负载 | 说明 |
|---|---|---|
| `plaza:snapshot` | `{ onlineCount, activities[], leaderboard, version }` | 连接/重连时发送 |
| `plaza:online-update` | `{ count: number, version: number }` | 在线人数变化 |
| `plaza:feed` | `{ id, type, content, metadata, user, createdAt, version }` | 新广场动态 |
| `plaza:leaderboard-update` | `{ type: 'daily' \| 'streak', version: number }` | 榜单需刷新（客户端调 API 拿全量） |
| `socket:error` | `{ message, version?: number }` | 错误通知 |

### 客户端 → 服务端

客户端不发送任何业务事件。Socket.IO 原生 ping/pong 负责连接保活；加入/退出房间、创建和发送动态均由服务端按身份决定。

---

## 8. API 端点

| 方法 | 路径 | 说明 | 实现状态 |
|---|---|---|---|
| POST | `/api/register` | 注册 | 已有 |
| POST | `/api/auth/*` | NextAuth 认证 | 已有 |
| GET | `/api/articles` | 文章列表 | 已有（含自动播种） |
| GET | `/api/progress` | 用户进度 | 已有 |
| POST | `/api/progress/complete` | **完成文章（含事务+广场事件）** | 需改造 |
| GET | `/api/plaza/snapshot` | 在线人数+最近 50 条动态+双榜单+version | 需新建 |
| POST | `/api/internal/plaza/enter` | Socket.IO 服务创建进入广场动态；仅内部服务凭证可调用 | 需新建 |
| GET/POST | `/api/admin/articles` | 文章管理 | 已有 |
| GET/PUT | `/api/admin/badges` | 徽章管理 | 需新建 |
| POST | `/api/ai/quiz` | AI 出题代理 | 已有 |

---

## 9. 前端 PlazaContext

```text
PlazaContext（客户端 only）
├── socket.status          'connecting' | 'connected' | 'disconnected'
├── onlineCount            number
├── activities             PlazaActivity[]（最近动态列表）
├── leaderboard            { daily, streak }
├── version                number
│
├── connect()              建立 Socket.IO 连接
├── disconnect()           断开连接
├── refreshSnapshot()      调 /api/plaza/snapshot
│
└── 监听事件
    ├── plaza:snapshot       → 初始化状态
    ├── plaza:online-update  → 更新在线人数
    ├── plaza:feed           → 插入动态到列表头部
    └── plaza:leaderboard-update → 以事件 version 标记榜单需要刷新
```

数据库连接、JWT 解析、Redis 密钥均不暴露到前端。

---

## 10. 实施顺序

```
Phase 1 ─── 数据库地基
│  1. 更新 prisma/schema.prisma（新增 4 张表 + 调整 UserProgress）
│  2. prisma migrate dev
│  3. 编写数据迁移脚本：completedArticleIds JSON → ArticleCompletion 行
│
Phase 2 ─── 写作路径闭环
│  4. 改造 POST /api/progress/complete（事务 + PlazaActivity + 徽章计算）
│
Phase 3 ─── Redis + Socket.IO
│  5. 安装依赖：ioredis, socket.io, socket.io-client, @socket.io/redis-adapter
│  6. 搭建 Socket.IO 独立服务（JWT 验证 + 在线状态 + 广播）
│  7. Next.js 侧接入 ioredis（发布 plaza:events）
│
Phase 4 ─── 前端
│  8. PlazaContext + socket.io-client
│  9. plaza/page.tsx 接入实时数据
│  10. 排行榜页面
```

---

## 11. 迁移实施细节

### 从 `completedArticleIds` JSON 迁移到 `ArticleCompletion`

```sql
INSERT INTO article_completions (id, userId, articleId, learningDate, completedAt)
SELECT
    UUID() as id,
    up.userId,
    JSON_UNQUOTE(JSON_EXTRACT(arr.item, '$')) as articleId,
    up.lastCompletedDate,
    up.updatedAt
FROM user_progress up
CROSS JOIN JSON_TABLE(
    up.completedArticleIds,
    '$[*]' COLUMNS(item JSON PATH '$')
) AS arr
WHERE up.completedArticleIds IS NOT NULL
  AND JSON_LENGTH(up.completedArticleIds) > 0;
```

### 迁移后验证

- `UserProgress.completedArticleIds` 不再从代码中写入（可保留字段读，兼容过渡期）
- `ArticleCompletion` 是新真理来源
- 下线后可删除 `completedArticleIds` 列

---

## 12. 常量与类型

```ts
// types/plaza.ts
export type PlazaActivityType = 'ENTER_PLAZA' | 'ARTICLE_COMPLETED' | 'BADGE_EARNED';

export interface PlazaActivityPayload {
  id: string;
  version: number;
  type: PlazaActivityType;
  content: string;
  metadata?: {
    articleId?: string;
    articleTitle?: string;
    badgeCode?: string;
    badgeName?: string;
  };
  user: { id: string; username: string };
  createdAt: string;
}
```

## 13. 环境变量

```bash
# .env 新增
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

SOCKET_IO_PORT=3001
NEXTAUTH_SECRET=  # 已有，Socket.IO 共用
PLAZA_INTERNAL_SECRET=  # Socket.IO 服务调用 Next.js 内部广场接口的服务端密钥，不发送给浏览器
```
