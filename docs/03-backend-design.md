# 像素英语小镇：后端设计文档

## 1. 架构

Next.js 负责页面、认证和 REST API；独立 Socket.IO 服务负责学习广场实时连接；MySQL 保存所有业务真相；Redis 保存可重建的在线状态、排行榜缓存和 Socket.IO Pub/Sub。

```text
Browser ──HTTP──> Next.js API ──> MySQL
   │                   │
   └─Socket.IO────────> Realtime Service ──> Redis
                              │
                              └────────────> MySQL（快照/授权）
```

Socket 握手必须验证 NextAuth JWT，不信任客户端传入的 `userId`、昵称或角色。

## 2. API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/register` | 创建昵称、邮箱、密码和初始进度。 |
| GET | `/api/plaza/snapshot` | 返回在线人数、双榜单、最近 50 条动态和版本号。 |
| POST | `/api/progress/complete` | 原子完成文章、更新连续学习、计算徽章、发布广场事件。 |
| POST | `/api/ai/quiz` | 临时接收 DeepSeek Key，代理生成题目。 |
| GET/PUT | `/api/admin/badges` | 管理员读取、校验、保存并发布徽章 JSON。 |

`/api/ai/quiz` 必须拒绝空 Key、过长文章和超限请求；调用 DeepSeek 时禁止记录 Authorization 头和上游完整错误对象。该接口不保存 Key。

## 3. 实时事件

客户端只需要连接、心跳和接收事件；加入广场由服务端从已验证身份决定。

```ts
'plaza.snapshot'       // 初始或重连快照
'presence.updated'     // 去重后的在线人数
'feed.created'         // ARTICLE_COMPLETED / BADGE_EARNED
'leaderboard.updated'  // daily / streak
'socket.error'
```

同一用户多标签页只计一次在线。Redis 保存用户关联的 socket 集合并带 TTL；断连删除 socket，心跳续期，TTL 到期后自动剔除。

## 4. 完成文章的一致性

1. 服务端以 `Asia/Shanghai` 得到学习日期。
2. 在 MySQL 事务内创建 `ArticleCompletion`；联合唯一约束冲突时返回“已完成”，不再累计数据。
3. 在同一事务内更新 `UserProgress`、计算满足条件的新徽章、写入 `UserBadge` 和广场 `FeedPost`。
4. 事务成功后更新 Redis 双榜单，并广播动态与榜单事件。
5. 若广播或 Redis 更新失败，不回滚业务；客户端通过快照恢复，Redis 可由 MySQL 重建。

## 5. 徽章配置规则

后台保存 JSON 前必须通过 JSON Schema 和业务语义校验。规则仅允许声明式指标比较（如完成文章数、连续天数、指定难度完成数），禁止 JavaScript、SQL、模板执行或任意表达式。发布新版本只影响未来计算；已授予的 `UserBadge` 保留徽章名称、图标和描述快照。

## 6. 安全与限流

- 注册、登录、Socket 建连、完成文章和 AI 出题均限流。
- 昵称、文章标题和徽章文案在展示前按文本处理，禁止渲染不可信 HTML。
- 认证、管理、AI 代理均仅服务端鉴权；管理员接口复用现有 `requireAdmin`。
- 数据库的日榜和连续学习日期计算统一使用 `Asia/Shanghai`，不得使用 `toISOString().split('T')[0]` 作为业务日期。
