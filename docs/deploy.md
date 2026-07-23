# 部署指南

## 前置条件

远程服务器上已有：
- Docker + Docker Compose
- MySQL 容器（已有数据库 `pixel_town`）
- Redis 容器

## 1. 将 MySQL / Redis 加入共享网络

```bash
# 在远程服务器上执行
docker network create pixel-net

# 把已有的 MySQL 容器加入网络（替换 mysql-container 为实际容器名）
docker network connect pixel-net mysql-container

# 把已有的 Redis 容器加入网络
docker network connect pixel-net redis-container
```

## 2. 上传项目到服务器

```bash
# 本地：打包并上传
git archive --format=tar HEAD | gzip > pixel-english-town.tar.gz
scp pixel-english-town.tar.gz user@your-server:/opt/

# 服务器：解压
ssh user@your-server
cd /opt
tar xzf pixel-english-town.tar.gz -C pixel-english-town
cd pixel-english-town
```

## 3. 配置环境变量

```bash
# 在服务器项目根目录
cp .env.production.example .env.production
vim .env.production   # 填入真实值
```

关键配置：
- `DATABASE_URL` —— 指向 MySQL 容器名（如 `mysql:3306`）
- `REDIS_URL` —— 指向 Redis 容器名（如 `redis:6379`）
- `WEB_ORIGIN` —— 用户访问前端的 URL
- `NEXT_PUBLIC_SOCKET_URL` —— 用户浏览器连接 Socket.IO 的 URL

## 4. 数据库迁移

```bash
# 首次部署：执行 Prisma 迁移
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  npx prisma migrate deploy
```

## 5. 启动服务

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 6. 验证

```bash
# 检查容器状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 测试 API 健康检查
curl http://localhost:4000/api/v1/health

# 测试前端
curl http://localhost:3000
```

## 7. 配置 Nginx 反向代理（推荐）

```nginx
# /etc/nginx/sites-available/pixel-english-town
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 如果 MySQL/Redis 不在 Docker 里

修改 `.env.production` 中的连接地址为实际 IP：

```bash
DATABASE_URL="mysql://pixel_town:密码@10.0.0.5:3306/pixel_town"
REDIS_URL="redis://10.0.0.6:6379"
```

并从 `docker-compose.prod.yml` 中删除 `networks:` 块。
