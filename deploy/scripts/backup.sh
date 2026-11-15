#!/usr/bin/env bash
# Back up the bind-mounted state. Run from deploy/ on the app VM (cron-able):
#   ./scripts/backup.sh [layout]     layout = external-db (default) | local-db
# local-db  : pg_dump both databases through the postgres container.
# external-db: run pg_dump on the DB VM (its own cron); this script then only
#              archives the content store directory.
# The secrets file is $DEPLOY_ROOT/.env (override with ENV_FILE), the same one the
# stack and the runner use; without --env-file Compose cannot resolve the
# required variables and every command fails.
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
  COMPOSE=(docker compose --project-directory . --env-file "${ENV_FILE:-$ROOT/.env}" --profile local-db -f compose.yml)
  for db in cnh_planner cnh_content; do
    "${COMPOSE[@]}" exec -T postgres sh -c "pg_dump -U \"\$POSTGRES_USER\" --format=custom $db" > "$OUT/$db.dump"
    # A failed pg_dump must not leave an empty file that looks like a backup.
    [ -s "$OUT/$db.dump" ] || { echo "pg_dump of $db produced no data" >&2; rm -rf "$OUT"; exit 1; }
  done
fi

# Keep 14 days.
find "$ROOT/backups" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "Backup written to $OUT"
