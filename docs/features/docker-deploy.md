# Feature — Docker deploy on one VM

🇻🇳 Bản tiếng Việt: [docker-deploy.vi.md](docker-deploy.vi.md)

## Summary

The owner can run the whole site on a single Linux VM with Docker Compose: nginx in
front, the Next.js app behind it, and PostgreSQL either in the same stack or on
another VM. All state — the content store, the PostgreSQL cluster, logs, backups —
is a **bind mount** under `/opt/chuyennhahung`, so it is visible on the host and
survives `docker compose down -v`. This document is the step-by-step runbook;
[usage → Deploy](../usage.md#deploy) keeps the reference.

## Routes

None. The only HTTP surface added to the host is `GET /nginx-health` (nginx
liveness, not proxied); the app's own `GET /api/health` already existed.

## Data

No application data model changes. The bind-mounted directories:

| Host path (`DEPLOY_ROOT`) | In container | Owner | Holds |
|---|---|---|---|
| `data/app` | `app`, `tools`: `/app/.data` | uid 1000 (`node`) | Travel content JSON store (when `CONTENT_DATABASE_URL` is empty) |
| `data/postgres` | `postgres`: `/var/lib/postgresql/data` | uid 70 | PostgreSQL cluster (local-db layout only) |
| `logs/nginx` | `nginx`: `/var/log/nginx` | root | access and error logs |
| `import` | `tools`: `/import` (read-only) | uid 1000 | `planner.json` for `planner:import` |
| `secrets/pg-ca.crt` | `app`, `tools`: `/run/secrets/pg-ca.crt` (read-only) | root, 644 | public CA for the external DB (external-db layout) |
| `backups` | — | root, 750 | output of `backup.sh` |

Secrets (`ADMIN_API_TOKEN`, database passwords, Google client secret) live only in
`deploy/.env` (mode 600, never committed). `NEXT_PUBLIC_SITE_URL` is a **build**
argument: changing it needs `up -d --build`.

## How it works

Two layouts, picked by one overlay file; `compose.app.bind.yml` is added to both.

1. **Prepare the VM** (Ubuntu 24.04 or similar, Docker Engine + Compose v2, 2 GB RAM
   plus swap because `next build` is the memory peak):
   ```bash
   sudo ./deploy/scripts/setup-host.sh external-db   # or: local-db
   ```
   It creates the bind-mount directories with the right owners. Do this **before**
   `up`: Docker creates a missing bind path as `root`, and a missing file path as a
   directory, which breaks the app.
2. **Configure**: `cp deploy/.env.example deploy/.env && chmod 600 deploy/.env`, then
   fill it in (`openssl rand -base64 36` for `ADMIN_API_TOKEN`). External DB: put the
   CA at `/opt/chuyennhahung/secrets/pg-ca.crt` and set `PLANNER_DATABASE_URL` with
   `sslmode=verify-full`. Local DB: set `POSTGRES_ADMIN_PASSWORD`, `CNH_APP_PASSWORD`
   and both `*_DATABASE_URL` values pointing at host `postgres`.
3. **Start** (from `deploy/`):
   ```bash
   # PostgreSQL on a separate VM
   docker compose -f compose.yml -f compose.app.yml -f compose.app.bind.yml \
     -f compose.app.external-db.yml up -d --build
   # PostgreSQL in this stack
   docker compose --profile local-db -f compose.yml -f compose.app.yml \
     -f compose.app.bind.yml -f compose.app.local-db.yml up -d --build
   ```
   Migrations run by themselves when the app first uses the database (ADR 0009). The
   `postgres` init script (`deploy/postgres/init/`) runs **once**, on an empty data
   directory, creating `cnh_app` and the `cnh_planner` / `cnh_content` databases.
4. **Verify**: `curl -i http://<vm-ip>/api/health` → `200 {"status":"ok"}`;
   `docker compose ps` shows `healthy`; open `/`, `/en`, sign in, create a trip.
5. **Update**: `git pull`, rerun the same `up -d --build`. nginx serves
   `maintenance.html` (503) while the app restarts. **Rollback**: check out the
   previous commit and rerun; restore `backups/<stamp>/` if data changed.
6. **Back up**: `./scripts/backup.sh <layout>` from cron (daily). Local-db dumps both
   databases with `pg_dump --format=custom`; external-db archives only `data/app` —
   dump on the DB VM itself. Restore: `pg_restore` into a fresh database; untar
   `app-data.tgz` into `data/` with the app stopped.

Network: `edge` (nginx ↔ app) and `backend` (`internal: true`, app ↔ postgres, no
route out). Only nginx publishes a port. nginx **overwrites** `X-Forwarded-For` and
`X-Forwarded-Proto` (the rate limiter keys on them) and resolves `app` per request so
it starts before the app does.

## Files

| Path | Role |
|---|---|
| `Dockerfile`, `.dockerignore` | Image: `runner` and `tools` targets (existing) |
| `deploy/compose.yml` | nginx and the optional `postgres` service, networks, bind mounts |
| `deploy/compose.app.yml` | `app` and `tools` services (existing; now passes `CONTENT_DATABASE_URL`) |
| `deploy/compose.app.bind.yml` | Replaces the `app-data` named volume by a host bind mount |
| `deploy/compose.app.local-db.yml`, `deploy/compose.app.external-db.yml` | Database layout overlays (existing) |
| `deploy/nginx/default.conf`, `deploy/nginx/maintenance.html` | Reverse proxy and the maintenance page |
| `deploy/nginx-app.conf` | Header snippet for a stack that already runs its own nginx (existing) |
| `deploy/postgres/init/10-roles-and-databases.sh` | First-start role and database creation |
| `deploy/.env.example` | Every variable, both layouts |
| `deploy/scripts/setup-host.sh`, `deploy/scripts/backup.sh` | Host preparation and backups |

## Tests

None automated: these are infrastructure files and no test in `tests/` runs Docker.
`tests/docs.test.ts` covers the documents. Checked by hand: shell syntax
(`bash -n`) and YAML parsing of every compose file. **Not run**: `docker compose
config`, `docker build` and a real deploy — Docker is not installed on the dev
machine and no VM was touched.

## Limits and open questions

- **Untested on a VM.** Run `docker compose … config` first, and a smoke test on a
  scratch VM, before relying on it. The `postgres` profile being started as a
  dependency of `app` (`depends_on`) should be confirmed with `docker compose ps`.
- Plain HTTP: cookies are not `Secure`, HSTS is ignored, Google sign-in cannot work
  on an IP. TLS (certbot or an upstream load balancer) is the next step; then set
  `NEXT_PUBLIC_SITE_URL` to the https origin and rebuild.
- One `app` replica only; the rate limiter is in memory and the content JSON store is a
  single file (ADR 0013).
- The app role owns the databases and migrates at startup (accepted risk, ADR 0009).
- `backup.sh` does not copy backups off the VM, and nothing monitors the host. An
  off-host copy and an alert are the owner's to arrange.
- Image publishing to a registry and a CI deploy workflow are out of scope (CLAUDE.md:
  no deploy without the owner's go-ahead).
