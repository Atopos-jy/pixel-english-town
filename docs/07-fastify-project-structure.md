# Fastify 后端项目结构与编码规范

本文定义当前仓库中 Fastify API 的实际目录、职责边界和后续业务接口迁移规则。Next.js 页面与未迁移的 Next Route Handler 仍保留在仓库根目录。

## 1. 当前项目结构

```text
pixel-english-town/
├── app/                         # Next.js 页面与未迁移的 Route Handler
├── components/                  # Next.js 组件
├── contexts/                    # 前端状态上下文
├── lib/                         # 现有前端/Next 服务端工具
├── prisma/
│   ├── schema.prisma            # 全项目唯一 Prisma Schema
│   └── migrations/              # 全项目数据库迁移历史
├── server/
│   └── socket-server.mjs        # 当前 Socket.IO 服务
├── apps/
│   └── api/                     # Fastify REST API
│       └── src/
│           ├── app.ts           # Fastify 实例、插件和模块注册
│           ├── server.ts        # 服务启动入口
│           ├── config/
│           │   ├── env.ts       # 环境变量校验
│           │   └── database.ts  # Prisma Client 生命周期
│           ├── middleware/
│           │   ├── auth.ts      # 会话校验 preHandler
│           │   └── error.ts     # 全局错误处理
│           ├── utils/
│           │   └── response.ts  # 统一 ApiResponse 工厂
│           └── modules/
│               ├── auth/        # 已迁移的认证领域模块
│               │   ├── routes.ts
│               │   ├── controller.ts
│               │   ├── service.ts
│               │   └── types.ts
│               └── articles/    # 已迁移的文章列表与详情
│                   ├── routes.ts
│                   ├── controller.ts
│                   ├── service.ts
│                   └── types.ts
├── packages/
│   └── contracts/               # 前后端共享 ApiResponse、ApiCode 等类型
├── .env                         # 当前根目录环境变量文件（不提交）
├── .env.example                 # 环境变量示例
├── next.config.js               # /api/v1/* 重写至 Fastify
└── package.json                 # 根 workspace 脚本
```

## 2. 目录职责

### `prisma/`

- 根目录 `prisma/schema.prisma` 是唯一 Schema 来源。
- 所有 Prisma migration 均保留在根目录 `prisma/migrations/`。
- Fastify 通过 `@prisma/client` 使用同一份生成的 Client。
- 未经明确确认，不迁移、复制或删除 Schema/Migration。

### `apps/api/src/config/`

- `env.ts`：使用 Zod 校验 Fastify 服务所需环境变量。
- `database.ts`：创建 Prisma Client，并在 Fastify 关闭时断开连接。

### `apps/api/src/middleware/`

- `auth.ts`：提供认证 preHandler。`requireAuth` 校验 HttpOnly Cookie 中的 JWT 和 `user_sessions` 的撤销/过期状态；`optionalAuth` 只在会话有效时挂载 `request.authenticatedSession`，用于退出登录等需保持幂等的接口。
- `error.ts`：全局错误处理，统一输出 `ApiResponse<T>`。

### `apps/api/src/modules/<domain>/`

每个已迁移领域使用同一目录结构：

| 文件            | 职责                                            | 禁止事项                          |
| --------------- | ----------------------------------------------- | --------------------------------- |
| `types.ts`      | Zod Schema、DTO、模块类型与常量                 | 不包含业务流程                    |
| `service.ts`    | 业务逻辑、Prisma 读写、事务                     | 不访问 Fastify `request`、`reply` |
| `controller.ts` | 参数校验、调用 service、Cookie/JWT 与 HTTP 响应 | 不直接操作 Prisma                 |
| `routes.ts`     | 路径、HTTP 方法、preHandler 与 controller 绑定  | 不写业务逻辑                      |

当前已迁移模块为 `auth` 与 `articles`（仅文章列表、详情）。后续按业务迁移节奏新增同级模块，例如：

```text
modules/
├── learning/    # 完成文章、学习进度
├── questions/   # 作答、收藏、错题
├── quiz/        # AI 出题与任务查询
├── badges/      # 徽章
├── plaza/       # 广场快照、排行榜、动态
├── ai/          # AI 设置与测试
├── speaking/    # 口语评测、转写任务
└── admin/       # 后台统计、用户管理等
```

这些目录是未来按模块迁移时创建的目标，不代表当前已迁移完成。

## 3. 编码约定

- 使用 TypeScript，接口与 DTO 必须有精确类型，禁止 `any`。
- 所有请求参数和请求体均使用 Zod 校验。
- 所有接口返回 `ApiResponse<T>`，并统一调用 `utils/response.ts`。
- 受保护路由使用 `middleware/auth.ts` 的 `requireAuth`；退出登录等需要无论会话是否有效都成功的接口可使用 `optionalAuth`。不在各 controller 重复解析 JWT 或查询会话。
- 涉及多表写入时，在 service 层使用 Prisma 交互式事务。
- 未迁移的 `app/api/**` Route Handler 必须保留，直到相应 Fastify 模块完成前端切换和验收。
- 不恢复 NextAuth；JWT、密码和会话信息不得写入 `localStorage` 或 Redis。

## 4. 迁移顺序

1. 文章与学习进度：`articles`、`learning`。
2. 题目与测验：`questions`、`quiz`。
3. 广场与实时能力：`plaza`；Socket.IO 继续独立运行。
4. 后台模块：`admin`。
5. OSS 上传与 Deepgram 转写：按实际职责归入对应模块。

每完成一个模块，先切换前端至 `/api/v1`、本地验收，再决定是否需要数据库迁移。未经确认不得删除对应的 Next Route Handler、修改数据库或部署服务。
