#!/usr/bin/env bash
# One-time host preparation for the bind mounts of deploy/compose.yml.
# Run on the VM with sudo:  sudo ./scripts/setup-host.sh [layout]
#   layout = external-db (default) | local-db
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/chuyennhahung}"
LAYOUT="${1:-external-db}"

# A bind mount of a missing path makes Docker create it as root; create each
# directory first with the owner its container user needs.
install -d -m 750 -o 1000 -g 1000 "$ROOT/data/app"       # node (app image)
install -d -m 755 "$ROOT/logs/nginx"
install -d -m 750 -o 1000 -g 1000 "$ROOT/import"          # planner:import input
install -d -m 750 "$ROOT/backups"
install -d -m 755 "$ROOT/secrets"                          # pg-ca.crt (public cert)

if [ "$LAYOUT" = "local-db" ]; then
  install -d -m 700 -o 70 -g 70 "$ROOT/data/postgres"      # postgres (alpine image)
else
  echo "external-db: copy the DB CA to $ROOT/secrets/pg-ca.crt (chmod 644) BEFORE 'up'."
fi
echo "Host ready under $ROOT ($LAYOUT)."
