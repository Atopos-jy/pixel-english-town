#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
set -a
source .env
set +a

backup_dir="${BACKUP_DIR:-/opt/pixel-town-db/backups}"
timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
  mysqldump -uroot --single-transaction --routines --events --triggers "$MYSQL_DATABASE" \
  | gzip > "$backup_dir/${MYSQL_DATABASE}-${timestamp}.sql.gz"

find "$backup_dir" -type f -name "${MYSQL_DATABASE}-*.sql.gz" -mtime +14 -delete
