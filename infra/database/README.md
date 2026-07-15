# 共享开发数据库

此目录只部署一套 MySQL 8.4 数据库：`pixel_town`。MySQL 仅绑定服务器本机 `127.0.0.1:3306`，开发机必须通过 SSH 隧道连接。

## 服务器初始化

```bash
mkdir -p /opt/pixel-town-db
cp .env.example .env
chmod 600 .env
nano .env
docker compose up -d
docker compose ps
```

真实 `.env` 只保留在服务器，必须填写两个不同的随机密码。

## 本地连接

```bash
ssh -N -L 13306:127.0.0.1:3306 root@120.26.133.223
```

本地项目 `.env`：

```env
DATABASE_URL="mysql://pixel_town:YOUR_PASSWORD@127.0.0.1:13306/pixel_town"
```

然后从本地项目根目录执行：

```bash
npx prisma migrate deploy
```

## 备份

```bash
chmod 700 backup.sh
./backup.sh
```

脚本默认保留 14 天备份。建议后续配置定时任务，并同步备份到服务器外部。
