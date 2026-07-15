#!/usr/bin/env bash
# 遇到命令失败、未定义变量或管道失败时立即退出，避免产生伪成功备份。
set -euo pipefail

# 无论从哪个目录运行，都切换到本脚本和服务器 .env 所在目录。
cd "$(dirname "$0")"
# 让 .env 中的 MYSQL_* 变量在本脚本进程中可用。
set -a
source .env
set +a

# 默认备份目录位于服务器；可通过 BACKUP_DIR 环境变量覆盖。
backup_dir="${BACKUP_DIR:-/opt/pixel-town-db/backups}"
# 文件名使用执行时间，避免覆盖上一份备份。
timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

# 从 MySQL 容器导出共享开发库并压缩；不会导出其他数据库。
docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
  mysqldump -uroot --single-transaction --routines --events --triggers "$MYSQL_DATABASE" \
  | gzip > "$backup_dir/${MYSQL_DATABASE}-${timestamp}.sql.gz"

# 自动删除 14 天前的同类备份；重要备份仍应同步到服务器外部。
find "$backup_dir" -type f -name "${MYSQL_DATABASE}-*.sql.gz" -mtime +14 -delete
