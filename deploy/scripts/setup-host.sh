#!/usr/bin/env bash
# One-time host preparation for the bind mounts of deploy/compose.yml.
# Run on the VM with sudo:  sudo ./scripts/setup-host.sh [layout]
#   layout = external-db (default) | local-db
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/chuyennhahung}"
LAYOUT="${1:-external-db}"

# $ROOT goes into a sed expression and a logrotate file: keep it to plain path characters.
[[ "$ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo "DEPLOY_ROOT must be an absolute path of letters, digits, . _ - /" >&2; exit 2; }

# A bind mount of a missing path makes Docker create it as root; create each
# directory first with the owner its container user needs.
install -d -m 750 -o 1000 -g 1000 "$ROOT/data/app"       # node (app image)
install -d -m 750 "$ROOT/logs/nginx"
install -d -m 750 -o 1000 -g 1000 "$ROOT/import"          # planner:import input
install -d -m 750 "$ROOT/backups"
install -d -m 755 "$ROOT/secrets"                          # pg-ca.crt (public cert)

# Log retention: access 14 days, error 30 days. Needs logrotate (Debian/Ubuntu: present).
if [ -d /etc/logrotate.d ]; then
  sed "s#/opt/chuyennhahung#$ROOT#g" "$(dirname "$0")/../logrotate/chuyennhahung" > /etc/logrotate.d/chuyennhahung
  chmod 644 /etc/logrotate.d/chuyennhahung
else
  echo "logrotate not found: install it and copy deploy/logrotate/chuyennhahung to /etc/logrotate.d/." >&2
fi

if [ "$LAYOUT" = "local-db" ]; then
  install -d -m 700 -o 70 -g 70 "$ROOT/data/postgres"      # postgres (alpine image)
else
  echo "external-db: copy the DB CA to $ROOT/secrets/pg-ca.crt (chmod 644) BEFORE 'up'."
fi
echo "Host ready under $ROOT ($LAYOUT)."
