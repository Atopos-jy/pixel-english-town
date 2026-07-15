# 共享数据库：Ubuntu 原生 MySQL

服务器 `120.26.133.223` 运行 Ubuntu 原生 MySQL 8.0，不再使用 Docker MySQL。

| 名称 | 值 | 用途 |
| --- | --- | --- |
| 数据库 | `pixel_town` | 两位开发者共同使用的项目数据库。 |
| 日常账号 | `pixel_town` | DataGrip 与项目 Prisma 使用的连接账号。 |
| MySQL 端口 | `127.0.0.1:3306` | 仅服务器本机监听，不能从公网直接访问。 |
| 本机隧道端口 | `127.0.0.1:13306` | 开发机通过 SSH 隧道访问服务器数据库。 |

## 开发机连接

在 Windows PowerShell 保持 SSH 隧道运行：

```powershell
ssh -N -L 13306:127.0.0.1:3306 root@120.26.133.223
```

本地项目根目录 `.env`：

```env
DATABASE_URL="mysql://pixel_town:YOUR_PASSWORD@127.0.0.1:13306/pixel_town"
```

再从本地项目根目录执行：

```bash
npx prisma migrate deploy
```

## DataGrip

DataGrip 使用内置 SSH Tunnel：数据库 Host 填 `127.0.0.1`、Port 填 `3306`、User 填 `pixel_town`、Database 填 `pixel_town`；SSH Host 填 `120.26.133.223`、Port 填 `22`。

## 备份

```bash
chmod 700 backup.sh
./backup.sh
```

该脚本必须在服务器以 root 运行，默认保留 14 天的 `pixel_town` 备份。建议后续同步备份到服务器外部。
