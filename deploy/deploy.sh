#!/usr/bin/env bash
# Deploy one image tag of the app to the self-hosted stack, check it, and roll
# back to the previous tag if it does not come up. Run by the `deploy-dev`
# workflow on the runner that lives on the dev VM (ADR 0016); usable by hand:
#
#   APP_IMAGE=ghcr.io/<owner>/chuyennhahung-app GHCR_USER=<user> GHCR_TOKEN=<token> \
#     ./deploy/deploy.sh sha-<commit>
#
# The compose files used are the ones next to this script (the commit being
# deployed: compose.yml, compose.app.yml, the bind-mount overlay and the
# database overlay); `$STACK_DIR/.env` (mode 600, or 640 with the runner group) is passed to Compose and the
# state lives under DEPLOY_ROOT bind mounts. This script never reads or prints
# .env itself.
#
# First-time setup, run ONCE by hand as root (the runner cannot write STACK_DIR).
# DB_OVERLAY is required here: there is no safe default for the file's shape.
#
#   sudo SITE_URL=http://<ip-app> DB_OVERLAY=local-db ./deploy/deploy.sh --init-env
#
# writes `$STACK_DIR/.env` with freshly generated secrets (mode 640, group
# RUNNER_GROUP, default cnh-runner) and refuses to overwrite an existing file:
# PostgreSQL takes its password at the first start, so regenerating would make
# the file and the database disagree. It never prints a secret. For
# DB_OVERLAY=external-db also set PLANNER_DATABASE_URL (and optionally
# CONTENT_DATABASE_URL); nothing is generated for the database then. Do not put
# a database password on a command line you keep in shell history.
# external-db URLs must carry sslmode=verify-full (ADR 0009 §5).
#
# `deploy.sh --check` is the preflight for a new VM: it validates the file
# (secret lengths, TLS rule, CA file, mode) and prints key names and ok/FAIL only.
set -euo pipefail

init_env() {
  local stack="${STACK_DIR:-/opt/chuyennhahung}" file site overlay
  file="$stack/.env"
  site="${SITE_URL:?set SITE_URL, e.g. http://<ip-app>}"
  overlay="${DB_OVERLAY:?set DB_OVERLAY to local-db or external-db}"
  case "$overlay" in external-db | local-db) ;; *) echo "DB_OVERLAY must be external-db or local-db" >&2; exit 2 ;; esac
  # A value lands on one line of a Compose env file: no whitespace or control
  # characters (a newline would inject keys) and no `$` (Compose interpolates it).
  local safe='^[^[:space:][:cntrl:]$]+$'
  [[ "$site" =~ ^https?:// && "$site" =~ $safe ]] || { echo "SITE_URL must be an http(s) URL without spaces or \$" >&2; exit 2; }
  [[ -d "$stack" ]] || { echo "$stack does not exist (create it first, see docs/deploy-runbook.md)" >&2; exit 2; }
  [[ ! -e "$file" ]] || { echo "$file already exists; not overwriting (rotate secrets by hand)" >&2; exit 1; }
  command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 2; }
  if [[ "$overlay" == external-db ]]; then
    local url
    [[ -n "${PLANNER_DATABASE_URL:-}" ]] || { echo "set PLANNER_DATABASE_URL for external-db" >&2; exit 2; }
    for url in "$PLANNER_DATABASE_URL" "${CONTENT_DATABASE_URL:-postgres://-?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt}"; do
      [[ "$url" =~ ^postgres(ql)?:// && "$url" =~ $safe ]] \
        || { echo "database URLs must start with postgres:// and contain no spaces or \$" >&2; exit 2; }
      # The link crosses the LAN: TLS with full verification is not optional.
      [[ "$url" == *sslmode=verify-full* && "$url" == *sslrootcert=/run/secrets/pg-ca.crt* ]] \
        || { echo "database URLs must carry sslmode=verify-full and sslrootcert=/run/secrets/pg-ca.crt" >&2; exit 2; }
    done
  fi

  # Build the whole content first: a failed `openssl` aborts here, before any
  # byte is written (a half-written .env would block a rerun and hold a partial
  # set of secrets).
  local admin guest pw="" pgadmin="" body
  admin="$(openssl rand -base64 36)" && guest="$(openssl rand -hex 32)" || { echo "openssl rand failed" >&2; exit 1; }
  if [[ "$overlay" == local-db ]]; then
    pw="$(openssl rand -hex 24)" && pgadmin="$(openssl rand -hex 24)" || { echo "openssl rand failed" >&2; exit 1; }
  fi
  [[ -n "$admin" && -n "$guest" && ( "$overlay" != local-db || ( -n "$pw" && -n "$pgadmin" ) ) ]] \
    || { echo "openssl rand returned nothing" >&2; exit 1; }
  body="NEXT_PUBLIC_SITE_URL=$site
TRUST_PROXY_HEADERS=true
ADMIN_API_TOKEN=$admin
GUEST_KEY_SECRET=$guest
GOOGLE_SIGNUP_ENABLED=false
"
  if [[ "$overlay" == local-db ]]; then
    body+="POSTGRES_ADMIN_PASSWORD=$pgadmin
CNH_APP_PASSWORD=$pw
PLANNER_DATABASE_URL=postgres://cnh_app:$pw@postgres:5432/cnh_planner
CONTENT_DATABASE_URL=postgres://cnh_app:$pw@postgres:5432/cnh_content
"
  else
    body+="PLANNER_DATABASE_URL=$PLANNER_DATABASE_URL
"
    [[ -z "${CONTENT_DATABASE_URL:-}" ]] || body+="CONTENT_DATABASE_URL=$CONTENT_DATABASE_URL
"
  fi

  # umask 077 + noclobber: created private, and atomically refused if it exists.
  (umask 077; set -o noclobber; printf '%s' "$body" >"$file") || { echo "could not create $file" >&2; exit 1; }

  local group="${RUNNER_GROUP:-cnh-runner}"
  if getent group "$group" >/dev/null 2>&1; then
    chgrp "$group" "$file" && chmod 640 "$file" \
      || { echo "wrote $file but chgrp/chmod to $group failed: it stays mode 600; fix by hand" >&2; exit 1; }
  else
    echo "group $group not found: $file stays mode 600; chgrp/chmod 640 it once the runner exists" >&2
  fi
  echo "wrote $file (secrets not shown)"
}

# Preflight for a new VM: reads $STACK_DIR/.env to validate it, prints only
# key names and PASS/FAIL, never a value. Run by hand before the first deploy;
# `DB_OVERLAY` selects the layout (default external-db, like a deploy).
check_env() {
  local stack="${STACK_DIR:-/opt/chuyennhahung}" root="${DEPLOY_ROOT:-${STACK_DIR:-/opt/chuyennhahung}}"
  local file="$stack/.env" overlay="${DB_OVERLAY:-external-db}" fail=0
  case "$overlay" in external-db | local-db) ;; *) echo "DB_OVERLAY must be external-db or local-db" >&2; exit 2 ;; esac
  [[ -f "$file" && -r "$file" ]] || { echo "FAIL $file missing or unreadable" >&2; exit 1; }
  val() { sed -n "s/^$1=//p" "$file" | tail -n1; }
  bad() { echo "FAIL $1" >&2; fail=1; }
  local mode
  mode="$(stat -c %a "$file" 2>/dev/null || stat -f %Lp "$file")"
  [[ "$mode" =~ ^[0-7]*[0-7]0$ ]] && echo "ok   .env not world-accessible" || bad ".env is world-accessible (mode $mode)"
  [[ "$(val NEXT_PUBLIC_SITE_URL)" =~ ^https?://[^[:space:]]+$ ]] && echo "ok   NEXT_PUBLIC_SITE_URL" || bad "NEXT_PUBLIC_SITE_URL missing or not an http(s) URL"
  local k v
  for k in ADMIN_API_TOKEN GUEST_KEY_SECRET; do
    v="$(val "$k")"
    ((${#v} >= 32)) && echo "ok   $k (>= 32 chars)" || bad "$k missing or shorter than 32 characters (the feature answers 503)"
  done
  v="$(val PLANNER_DATABASE_URL)"
  [[ "$v" =~ ^postgres(ql)?:// ]] && echo "ok   PLANNER_DATABASE_URL" || bad "PLANNER_DATABASE_URL missing or not postgres://"
  local bind
  bind="$(val DB_BIND_ADDR)"
  [[ "$bind" != 0.0.0.0 && "$bind" != "::" ]] || bad "DB_BIND_ADDR must be the VM LAN IP, never 0.0.0.0 or ::"
  if [[ "$overlay" == local-db ]]; then
    for k in POSTGRES_ADMIN_PASSWORD CNH_APP_PASSWORD; do
      [[ -n "$(val "$k")" ]] && echo "ok   $k" || bad "$k missing"
    done
  else
    [[ "$v" == *sslmode=verify-full* && "$v" == *sslrootcert=/run/secrets/pg-ca.crt* ]] \
      && echo "ok   PLANNER_DATABASE_URL TLS" || bad "external-db needs sslmode=verify-full and sslrootcert=/run/secrets/pg-ca.crt in PLANNER_DATABASE_URL"
    v="$(val CONTENT_DATABASE_URL)"
    if [[ -n "$v" ]]; then
      [[ "$v" =~ ^postgres(ql)?:// && "$v" == *sslmode=verify-full* && "$v" == *sslrootcert=/run/secrets/pg-ca.crt* ]] \
        && echo "ok   CONTENT_DATABASE_URL TLS" || bad "CONTENT_DATABASE_URL must be postgres:// with sslmode=verify-full and sslrootcert=/run/secrets/pg-ca.crt"
    fi
    [[ -f "$root/secrets/pg-ca.crt" ]] && echo "ok   $root/secrets/pg-ca.crt is a file" || bad "$root/secrets/pg-ca.crt is missing or not a file"
  fi
  exit "$fail"
}

if [[ "${1:-}" == "--init-env" ]]; then
  init_env
  exit 0
fi
if [[ "${1:-}" == "--check" ]]; then
  check_env
fi

TAG="${1:?usage: deploy.sh <image-tag> | deploy.sh --init-env | deploy.sh --check}"
: "${APP_IMAGE:?set APP_IMAGE, e.g. ghcr.io/<owner>/chuyennhahung-app}"
STACK_DIR="${STACK_DIR:-/opt/chuyennhahung}"
DB_OVERLAY="${DB_OVERLAY:-external-db}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$STACK_DIR/.deployed-tag"
WAIT_SECONDS="${WAIT_SECONDS:-180}"

case "$DB_OVERLAY" in external-db | local-db) ;; *) echo "DB_OVERLAY must be external-db or local-db" >&2; exit 2 ;; esac
[[ "$TAG" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "invalid image tag: $TAG" >&2; exit 2; }

compose() {
  # Files and relative paths come from the commit being deployed; the
  # secrets file stays in STACK_DIR. Only `app` is ever (re)created here, so
  # the running nginx keeps the mounts it was started with.
  local profile=()
  [[ "$DB_OVERLAY" == local-db ]] && profile=(--profile local-db)
  docker compose --project-directory "$HERE" --env-file "$STACK_DIR/.env" ${profile[@]+"${profile[@]}"} \
    -f "$HERE/compose.yml" \
    -f "$HERE/compose.app.yml" \
    -f "$HERE/compose.app.bind.yml" \
    -f "$HERE/compose.app.$DB_OVERLAY.yml" "$@"
}

# The image the app container is actually running. A failed `up` leaves the OLD
# container in place, and its health check would pass: compare before trusting it.
running_image() {
  local id
  id="$(compose ps -q app 2>/dev/null)" || return 1
  [[ -n "$id" ]] && docker inspect -f '{{.Config.Image}}' "$id" 2>/dev/null
}

healthy() {
  [[ "$(running_image)" == "$APP_IMAGE:$APP_IMAGE_TAG" ]] || return 1
  compose exec -T app node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" \
    >/dev/null 2>&1
}

release() {
  export APP_IMAGE APP_IMAGE_TAG="$1"
  # Inside `if release …` set -e is off, so a failed `up` must return itself.
  # --no-deps: `app` depends on postgres in the local-db layout. Without the flag
  # Compose reconciles that dependency too and RECREATES the database container
  # whenever its definition differs from the running one (seen on the first deploy
  # on the dev VM, where the stack had been started from another checkout path).
  # PostgreSQL and nginx are started by hand once (docs/deploy-runbook.md, Phase 4)
  # and left alone here.
  compose up -d --no-build --no-deps app || return 1
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
