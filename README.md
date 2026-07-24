# 像素英语小镇 (Pixel English Town)

像素风格的英语学习平台——阅读、练习、收集徽章，在小镇里开始今天的英语冒险。

## 页面预览

![登录页](docs/assets/images/index.png)
![小镇总览](docs/assets/images/overview.png)
![学习广场](docs/assets/images/plaza.png)
![阅读学习](docs/assets/images/read.png)
![练习测验](docs/assets/images/test.png)
![个人中心](docs/assets/images/my.png)

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + React 18 + TypeScript + Tailwind CSS |
| API | Fastify + Zod + Prisma |
| 数据库 | MySQL (Prisma ORM) |
| 缓存 | Redis |
| 实时通信 | Socket.IO + Redis Pub/Sub |
| 语音转写 | Deepgram (nova-2) |
| 文件存储 | 阿里云 OSS |
| 包管理 | pnpm workspace |

## 项目结构

```
pixel-english-town/
├── apps/
│   ├── web/              # Next.js 前端
│   │   ├── app/          # App Router 页面
│   │   ├── components/   # React 组件
│   │   ├── contexts/     # 状态上下文
│   │   ├── lib/          # 工具库
│   │   └── public/       # 静态资源
│   ├── api/              # Fastify REST API
│   │   └── src/modules/  # 领域模块（四层架构）
│   └── socket/           # Socket.IO 实时服务
│       └── src/
├── packages/
│   └── contracts/        # 前后端共享类型
├── prisma/               # Schema + 数据库迁移
├── docs/                 # 设计文档
├── docker-compose.yml    # 本地开发环境
├── docker-compose.prod.yml # 生产部署配置
└── .env.example          # 环境变量模板
```

## 本地运行

### 前置条件

- Node.js >= 18
- pnpm >= 10
- MySQL（本地或通过 SSH 隧道连接远程）
- Redis（广场实时功能需要）

### 1. 安装 & 配置

```bash
pnpm install
cp .env.example .env
# 编辑 .env 填入数据库密码、Redis 地址等
pnpm db:deploy
```

### 2. 启动（需要三个终端）

```bash
# 终端 1：Fastify API（端口 4000）
pnpm dev:api

# 终端 2：Socket.IO（端口 3001）
pnpm socket

# 终端 3：Next.js 前端（端口 3000）
pnpm dev
```

访问 `http://localhost:3000`。

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Next.js 前端 |
| `pnpm dev:api` | 启动 Fastify API |
| `pnpm socket` | 启动 Socket.IO |
| `pnpm build` | 构建 Next.js 前端 |
| `pnpm build:api` | 编译 Fastify API |
| `pnpm db:generate` | 重新生成 Prisma Client |
| `pnpm db:deploy` | 应用数据库迁移 |
| `pnpm db:studio` | Prisma Studio 可视化管理 |

## 部署

详见 [docs/deploy.md](docs/deploy.md)。

快速步骤：
```bash
cp .env.production.example .env.production
# 编辑填入生产环境配置
docker network create pixel-net
docker network connect pixel-net mysql-pixel
docker network connect pixel-net redis
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 文档

- [01-需求文档](docs/01-requirements.md)
- [02-前端设计](docs/02-frontend-design.md)
- [03-后端设计](docs/03-backend-design.md)
- [04-数据库设计](docs/04-database-design.md)
- [05-广场实时方案](docs/05-plaza-realtime-plan.md)
- [06-代码风格](docs/06-code-style.md)
- [07-Fastify 项目结构与规范](docs/07-fastify-project-structure.md)
- [部署指南](docs/deploy.md)
