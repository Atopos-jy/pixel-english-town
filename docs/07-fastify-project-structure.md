# Fastify 后端项目结构与编码规范

本文定义当前仓库中 Fastify API 的实际目录、职责边界和编码规则。所有 API 接口已迁移至 Fastify，无 Next.js Route Handler 残留。

## 1. 当前项目结构

```text
pixel-english-town/
├── apps/
│   ├── web/                         # Next.js 前端
│   │   ├── app/                     # Next.js App Router 页面
│   │   ├── components/              # React 组件
│   │   ├── contexts/                # 前端状态上下文
│   │   ├── lib/                     # 前端工具库
│   │   ├── public/                  # 静态资源
│   │   ├── services/                # 前端服务层
│   │   ├── types/                   # 前端类型定义
│   │   ├── types.ts                 # 前端共享类型
│   │   ├── constants.ts             # 前端常量
│   │   ├── next.config.js           # Next.js 配置（含 /api/v1/* 代理）
│   │   ├── tsconfig.json            # 前端 TypeScript 配置
│   │   ├── tailwind.config.js       # Tailwind CSS 配置
│   │   └── postcss.config.js        # PostCSS 配置
│   ├── api/                         # Fastify REST API
│   │   └── src/
│   │       ├── app.ts               # Fastify 实例、插件和模块注册
│   │       ├── server.ts            # 服务启动入口
│   │       ├── config/
│   │       │   ├── env.ts           # 环境变量校验
│   │       │   └── database.ts      # Prisma Client 生命周期
│   │       ├── middleware/
│   │       │   ├── auth.ts          # 会话校验 preHandler
│   │       │   └── error.ts         # 全局错误处理
│   │       ├── utils/
│   │       │   └── response.ts      # 统一 ApiResponse 工厂
│   │       └── modules/
│   │           ├── shared/          # 跨模块共享
│   │           │   └── badgeDefaults.ts  # 徽章默认值
│   │           ├── auth/            # 认证（注册/登录/会话）
│   │           ├── articles/        # 文章列表与详情
│   │           ├── learning/        # 学习进度与完成文章
│   │           ├── questions/       # 作答、收藏、错题、分析
│   │           ├── quiz/            # AI 出题与任务查询
│   │           ├── badges/          # 徽章配置
│   │           ├── plaza/           # 广场快照、排行榜、动态
│   │           ├── ai/              # AI 设置与测试
│   │           ├── speaking/        # 口语评测
│   │           ├── admin/           # 后台统计、用户/文章/徽章管理
│   │           │   └── middleware.ts # admin 权限中间件
│   │           └── media/           # OSS 上传、音频转写
│   └── socket/                      # Socket.IO 实时服务
│       └── src/
│           └── socket-server.mjs
├── packages/
│   └── contracts/                   # 前后端共享 ApiResponse、ApiCode 等类型
├── prisma/
│   ├── schema.prisma                # 全项目唯一 Prisma Schema
│   └── migrations/                  # 全项目数据库迁移历史
├── docs/                            # 设计文档
├── .env                             # 当前根目录环境变量文件（不提交）
├── .env.example                     # 环境变量示例
├── package.json                     # 根 workspace 脚本
└── tsconfig.json                    # 根 TypeScript 配置（不含前端）
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

每个模块使用统一的四层架构：

| 文件            | 职责                                            | 禁止事项                          |
| --------------- | ----------------------------------------------- | --------------------------------- |
| `types.ts`      | Zod Schema、DTO、模块类型与常量                 | 不包含业务流程                    |
| `service.ts`    | 业务逻辑、Prisma 读写、事务                     | 不访问 Fastify `request`、`reply` |
| `controller.ts` | 参数校验、调用 service、Cookie/JWT 与 HTTP 响应 | 不直接操作 Prisma                 |
| `routes.ts`     | 路径、HTTP 方法、preHandler 与 controller 绑定  | 不写业务逻辑                      |

### `apps/api/src/modules/shared/`

跨模块共享的常量和类型，如徽章默认值。对应领域的模块可直接导入。

### `apps/socket/`

Socket.IO 实时服务，负责广场在线状态管理和跨进程消息广播。通过 Redis Pub/Sub 与 Fastify 通信。

### `apps/web/`

Next.js 前端应用。`next.config.js` 中配置 `/api/v1/*` 代理至 Fastify。

## 3. 编码约定

- 使用 TypeScript，接口与 DTO 必须有精确类型，禁止 `any`。
- 所有请求参数和请求体均使用 Zod 校验。
- 所有接口返回 `ApiResponse<T>`，并统一调用 `utils/response.ts`。
- 受保护路由使用 `middleware/auth.ts` 的 `requireAuth`；退出登录等需要无论会话是否有效都成功的接口可使用 `optionalAuth`。不在各 controller 重复解析 JWT 或查询会话。
- 涉及多表写入时，在 service 层使用 Prisma 交互式事务。
- 不恢复 NextAuth；JWT、密码和会话信息不得写入 `localStorage` 或 Redis。
- 跨模块共享代码（如加密工具、徽章默认值）放在 `modules/shared/` 或独立工具文件中。
- 语音转写使用 Deepgram API（`nova-2` 模型，支持逐词时间戳）；一个 `DEEPGRAM_API_KEY` 同时提供转录文本和 `{word, start, end}` 时间轴，前端可做发音波形同步高亮。
- AI 出题使用 DeepSeek / Mimo API（用户自行保存 API Key 到 AI 设置）。
- 文件上传使用阿里云 OSS。

## 4. 运行方式

### 启动全部服务（开发环境）

```bash
# 终端 1：Fastify API（端口 4000）
pnpm dev:api

# 终端 2：Socket.IO 实时服务（端口 3001）
pnpm socket

# 终端 3：Next.js 前端（端口 3000，/api/v1/* 代理至 4000）
pnpm dev
```

### 数据库操作

```bash
pnpm db:generate   # 生成 Prisma Client
pnpm db:deploy     # 执行数据库迁移
pnpm db:studio     # 打开 Prisma Studio
```

### 构建与部署

```bash
pnpm build:api     # 构建 Fastify API
pnpm build         # 构建 Next.js 前端（cd apps/web && next build）
```
