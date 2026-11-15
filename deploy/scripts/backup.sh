#!/usr/bin/env bash
# Back up the bind-mounted state. Run from deploy/ on the app VM (cron-able):
#   ./scripts/backup.sh [layout]     layout = external-db (default) | local-db
# local-db  : pg_dump both databases through the postgres container.
# external-db: run pg_dump on the DB VM (its own cron); this script then only
#              archives the content store directory.
# Files hold password hashes and token digests — owner-only (umask 077).
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
ROOT="${DEPLOY_ROOT:-/opt/chuyennhahung}"
LAYOUT="${1:-external-db}"
STAMP="$(date +%F-%H%M)"
OUT="$ROOT/backups/$STAMP"
mkdir -p "$OUT"

tar -C "$ROOT/data" -czf "$OUT/app-data.tgz" app

if [ "$LAYOUT" = "local-db" ]; then
  COMPOSE=(docker compose --profile local-db -f compose.yml -f compose.app.yml -f compose.app.bind.yml -f compose.app.local-db.yml)
  for db in cnh_planner cnh_content; do
    "${COMPOSE[@]}" exec -T postgres sh -c "pg_dump -U \"\$POSTGRES_USER\" --format=custom $db" > "$OUT/$db.dump"
  done
fi

# Keep 14 days.
find "$ROOT/backups" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "Backup written to $OUT"
