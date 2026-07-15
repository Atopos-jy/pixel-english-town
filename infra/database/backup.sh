#!/usr/bin/env bash
# 遇到命令失败、未定义变量或管道失败时立即退出，避免产生伪成功备份。
set -euo pipefail

# 无论从哪个目录运行，都切换到本脚本所在目录。
cd "$(dirname "$0")"

# 固定备份共享数据库 pixel_town；可通过 DATABASE_NAME 环境变量覆盖。
database_name="${DATABASE_NAME:-pixel_town}"
# 默认备份目录位于服务器；可通过 BACKUP_DIR 环境变量覆盖。
backup_dir="${BACKUP_DIR:-/opt/pixel-town-db/backups}"
# 文件名使用执行时间，避免覆盖上一份备份。
timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

# Ubuntu 原生 MySQL 的 root 账号使用本机 socket 认证；脚本必须由 root 运行。
# 导出共享数据库并压缩；不会导出其他数据库。
mysqldump -uroot --single-transaction --routines --events --triggers "$database_name" \
  | gzip > "$backup_dir/${database_name}-${timestamp}.sql.gz"

# 自动删除 14 天前的同类备份；重要备份仍应同步到服务器外部。
find "$backup_dir" -type f -name "${database_name}-*.sql.gz" -mtime +14 -delete
