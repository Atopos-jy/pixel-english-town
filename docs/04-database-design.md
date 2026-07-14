# 像素英语小镇：数据设计文档

## 1. 原则

MySQL 是学习完成、徽章、动态和榜单的最终事实来源；Redis 仅用于在线人数、实时广播和可重建的排行榜缓存。业务日按 `Asia/Shanghai` 计算。

## 2. 现有表调整

### User

增加 `username`，要求非空、规范化后唯一，用作小镇昵称和公开展示名。保留现有 `name` 时，应进行一次迁移：将旧 `name` 迁入 `username`；冲突用户由管理员补全。

### UserProgress

保留累计学习天数、完成数、连续学习天数和最长连续天数。`completedArticleIds` 与 `badges` JSON 不再作为唯一真相：分别迁移至 `ArticleCompletion` 与 `UserBadge`；为兼容旧页面可在过渡期生成返回值。

## 3. 新增实体

| 表 | 关键字段与约束 | 用途 |
| --- | --- | --- |
| `ArticleCompletion` | `userId`、`articleId`、`completedAt`、`learningDate`；`@@unique([userId, articleId])` | 防止同一文章重复计入完成。 |
| `BadgeDefinition` | `code` 唯一、`config Json`、`enabled`、`version`、`publishedAt` | 管理员发布的徽章类型与声明式规则。 |
| `UserBadge` | `userId`、`badgeCode`、`earnedAt`、`snapshot Json`；`@@unique([userId, badgeCode])` | 用户已获徽章与历史展示快照。 |
| `FeedPost` | `type`、`userId`、`payload Json`、`occurredAt` | 学习广场系统动态。 |

`FeedPost` 索引：`(occurredAt desc)`；`ArticleCompletion` 索引：`(learningDate, completedAt)`、`(userId, learningDate)`；`UserBadge` 索引：`(userId, earnedAt desc)`。

## 4. 徽章配置示例

```json
{
  "code": "first_article",
  "name": "初次启程",
  "description": "完成第一篇文章",
  "icon": "seedling",
  "enabled": true,
  "rule": {
    "metric": "totalArticlesCompleted",
    "operator": ">=",
    "value": 1
  }
}
```

允许的 `metric`：`totalArticlesCompleted`、`currentStreak`、`longestStreak`、`completedByDifficulty`。允许的 `operator`：`>=`、`=`。配置停用后不再授予，已获得记录不删除。

## 5. Redis Key

```text
presence:plaza:user:{userId}       Set(socketId)，TTL
leaderboard:daily:{YYYY-MM-DD}     ZSET，score=当日完成文章数
leaderboard:streak                 ZSET，score=当前连续学习天数
```

在线人数按存在有效 socket 的不同 `userId` 计数。Redis 丢失后，在线状态由有效连接恢复；榜单由 `ArticleCompletion` 和 `UserProgress` 重建。
