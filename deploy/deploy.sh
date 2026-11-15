#!/usr/bin/env bash
# Deploy one image tag of the app to the self-hosted stack, check it, and roll
# back to the previous tag if it does not come up. Run by the `deploy-dev`
# workflow on the runner that lives on the dev VM (ADR 0016); usable by hand:
#
#   APP_IMAGE=ghcr.io/<owner>/chuyennhahung-app GHCR_USER=<user> GHCR_TOKEN=<token> \
#     ./deploy/deploy.sh sha-<commit>
#
# The compose files used are the ones next to this script (the commit being
# deployed), while `.env`, `compose.yml` and the volumes stay in STACK_DIR.
# Nothing here reads or prints .env.
set -euo pipefail

TAG="${1:?usage: deploy.sh <image-tag>}"
: "${APP_IMAGE:?set APP_IMAGE, e.g. ghcr.io/<owner>/chuyennhahung-app}"
STACK_DIR="${STACK_DIR:-/opt/chuyennhahung}"
DB_OVERLAY="${DB_OVERLAY:-external-db}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$STACK_DIR/.deployed-tag"
WAIT_SECONDS="${WAIT_SECONDS:-180}"

case "$DB_OVERLAY" in external-db | local-db) ;; *) echo "DB_OVERLAY must be external-db or local-db" >&2; exit 2 ;; esac
[[ "$TAG" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "invalid image tag: $TAG" >&2; exit 2; }

compose() {
  docker compose --project-directory "$STACK_DIR" \
    -f "$STACK_DIR/compose.yml" \
    -f "$HERE/compose.app.yml" \
    -f "$HERE/compose.app.$DB_OVERLAY.yml" "$@"
}

healthy() {
  compose exec -T app node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" \
    >/dev/null 2>&1
}

release() {
  export APP_IMAGE APP_IMAGE_TAG="$1"
  compose up -d --no-build app
  local waited=0
  until healthy; do
    ((waited += 5))
    ((waited > WAIT_SECONDS)) && return 1
    sleep 5
  done
}

PREVIOUS=""
[[ -f "$STATE" ]] && PREVIOUS="$(<"$STATE")"
[[ -z "$PREVIOUS" || "$PREVIOUS" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "ignoring malformed $STATE" >&2; PREVIOUS=""; }

# The registry credential lives only for the pull.
if [[ -n "${GHCR_TOKEN:-}" ]]; then
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?set GHCR_USER}" --password-stdin >/dev/null
fi
export APP_IMAGE APP_IMAGE_TAG="$TAG"
compose pull app

echo "deploying $APP_IMAGE:$TAG (previous: ${PREVIOUS:-none})"
if release "$TAG"; then
  printf '%s\n' "$TAG" >"$STATE"
  docker image prune -f >/dev/null
  echo "deployed $TAG"
  exit 0
fi

echo "health check failed for $TAG" >&2
compose logs --tail 60 app >&2 || true
if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$TAG" ]]; then
  echo "rolling back to $PREVIOUS (database migrations are NOT rolled back)" >&2
  release "$PREVIOUS" || echo "rollback to $PREVIOUS is also unhealthy" >&2
fi
exit 1
