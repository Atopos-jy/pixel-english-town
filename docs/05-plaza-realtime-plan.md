# 广场实时系统实施方案

## 1. 范围与决定

广场实时功能采用独立 Socket.IO 服务、Redis 与 MySQL 的组合。广场动态是系统自动生成的学习事件，不提供用户自由输入、聊天室或匿名发言。

当前需要展示的事件：

- `ENTER_PLAZA`：用户进入学习广场。
- `COMPLETE_ARTICLE`：用户完成一篇文章。
- `EARN_BADGE`：用户获得徽章（徽章功能接入后启用）。

展示示例：

- `cyd 进入了学习广场`
- `cyd 完成了一篇文章`
- `cyd 获得了「连续学习 7 天」徽章`

## 2. 服务职责

```text
浏览器
  ├─ Next.js：页面、NextAuth、Prisma API、写入学习事件
  └─ Socket.IO 独立服务：验证连接、维护在线状态、向广场广播
          │
        Redis：在线状态、Socket 跨进程广播、排行榜缓存、事件通道
          │
        MySQL：用户、学习进度、广场动态的持久化数据
```

Next.js 与 Socket.IO 均可以部署在同一台云服务器，但必须作为两个独立进程运行。Nginx 将 `/socket.io/` 反向代理至 Socket.IO 服务。

## 3. 认证设计

项目当前使用 NextAuth JWT Session 策略。

- 浏览器连接同域 Socket.IO 时自动携带 NextAuth Session Cookie。
- Socket.IO 服务端使用与 Next.js 相同的 `NEXTAUTH_SECRET` 解码并验证 JWT。
- 验证成功后，才允许加入 `plaza` 房间和读取/接收实时事件。
- 验证失败立即断开连接；不允许匿名动态或匿名在线状态。

JWT/Session 不存入 Redis。Redis 只保存实时状态和缓存；身份来源仍是 NextAuth Cookie。若未来 Socket.IO 使用不同域名，再由已认证的 Next.js API 签发有效期极短的 Socket Ticket。

## 4. Redis Key 与通道

Redis 不是广场事件的永久数据源；服务重启后可安全清空。

| Key / Channel | 类型 | 用途 | 过期策略 |
|---|---|---|---|
| `plaza:presence:{socketId}` | String / JSON | Socket 对应的用户信息 | 心跳续期，45 秒 |
| `plaza:online` | Sorted Set | 用户 Socket 最近心跳时间 | 每次统计前移除超时成员 |
| `plaza:enter-cooldown:{userId}` | String | 限制重复“进入广场”动态 | 5 分钟 |
| `plaza:leaderboard:weekly` | String / JSON | 周排行榜缓存 | 60 秒 |
| `plaza:events` | Pub/Sub Channel | Next.js 向 Socket.IO 服务发布新事件 | 不持久化 |

## 5. MySQL 数据模型

现有表继续使用：

- `users`：用户昵称、角色。
- `user_progress`：学习天数、完成文章数、连续学习天数；排行榜的原始数据来源。

新增 Prisma 模型 `PlazaActivity`，映射为 `plaza_activities`：

```prisma
model PlazaActivity {
  id        String   @id @default(cuid())
  userId    String
  type      String
  content   String?  @db.VarChar(500)
  metadata  Json?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([userId, createdAt])
  @@map("plaza_activities")
}
```

同时在现有 `User` 模型增加：

```prisma
plazaActivities PlazaActivity[]
```

说明：

- `type` 仅允许后端定义的 `ENTER_PLAZA`、`COMPLETE_ARTICLE`、`EARN_BADGE`；前端不能自定义。
- `content` 由服务端按事件类型生成，不接收用户输入。
- `metadata` 保存文章 ID、文章标题、徽章 ID 等结构化数据。
- 在线用户不写 MySQL，避免频繁连接/刷新产生无意义记录。

数据库迁移在 Redis 连接信息和功能开发确认后执行；迁移前需先确保本机 SSH 隧道可连接远程 MySQL。

## 6. 事件写入与广播流程

### 用户进入广场

1. Socket.IO 服务验证 NextAuth Session Cookie。
2. 验证通过后写入 Redis 在线状态并加入 `plaza` 房间。
3. 使用 `plaza:enter-cooldown:{userId}` 防止刷新页面重复产生动态。
4. 未处于冷却期时，Next.js/Socket 服务创建 `PlazaActivity(ENTER_PLAZA)`。
5. 通过 Redis `plaza:events` 发布事件，Socket.IO 广播给 `plaza` 房间。

### 用户完成文章

1. 现有学习完成 API 先更新 `user_progress`。
2. 同一数据库事务内创建 `PlazaActivity(COMPLETE_ARTICLE)`。
3. 数据库提交成功后，Next.js 向 Redis `plaza:events` 发布事件。
4. Socket.IO 服务订阅该通道并广播给广场在线用户。

先写 MySQL、后发布 Redis，可避免广播了但数据库没有记录的假动态。

## 7. 排行榜

排行榜不增加独立 MySQL 表。Next.js API 按 `user_progress` 聚合后缓存到 Redis 60 秒。

推荐排序：

1. `totalArticlesCompleted` 降序。
2. `currentStreak` 降序。
3. `totalDaysLearned` 降序。

Socket.IO 只在排行榜缓存刷新或学习事件发生后发送“排行榜需要刷新”通知；完整榜单仍通过 Next.js API 获取。

## 8. 前端 PlazaContext

新增 `PlazaContext`，仅管理客户端实时状态：

- Socket 连接状态。
- 在线人数。
- 最近广场动态列表。
- 排行榜数据、加载状态与刷新方法。
- `ENTER_PLAZA`、`COMPLETE_ARTICLE`、`EARN_BADGE` 的 Socket 事件处理。

数据库访问、Token 解析和 Redis 密钥均不得进入前端 Context。

## 9. 实施前置项

- Redis 连接信息写入服务端 `.env`：主机、端口、密码、是否 TLS。
- Socket.IO 独立服务端口与正式域名/反向代理路径。
- 确认远程 MySQL SSH 隧道可用后执行 Prisma Migration。
- 新增依赖：`socket.io`、`socket.io-client`、`ioredis`、`@socket.io/redis-adapter`。

