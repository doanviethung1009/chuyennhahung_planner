# Deploy runbook — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

One document that takes you from a blank Linux VM to the app running behind nginx,
updated automatically by the self-hosted runner. It strings together what is
detailed in [docker-deploy](features/docker-deploy.md),
[deploy-runner](deploy-runner.md), [deploy-database](deploy-database.md) and
[usage → Deploy](usage.md#deploy); follow it top to bottom and open those for the
reasoning.

🇻🇳 Bản tiếng Việt: [deploy-runbook.vi.md](deploy-runbook.vi.md)

## What you are building

Everything runs in Docker on **one VM** except the runner and the host tooling.

| Where | What |
|---|---|
| Containers | `nginx` (port 80), `app` (Next.js, port 3000 inside), `postgres` (layout `local-db` only), `tools` (one-off scripts) |
| Host | Docker Engine, `ufw`, swap, the `cnh-runner` user and the GitHub Actions runner (a systemd service), cron backups |
| Bind mounts under `/opt/chuyennhahung` | `data/app`, `data/postgres`, `logs/nginx`, `import`, `secrets`, `backups` |
| `/opt/chuyennhahung/.env` | every secret; mode 640, group `cnh-runner`; never committed |

An update goes: merge into `main` → CI green → GitHub builds the image and pushes it
to GHCR → the runner on the VM runs `deploy/deploy.sh` → `app` is restarted on the new
tag and must report healthy within 180 s, otherwise the previous tag comes back.
**The runner only recreates `app`.** nginx and PostgreSQL must already be running, so
you start them by hand once (Phase 4).

## Choose a layout

| | `local-db` | `external-db` |
|---|---|---|
| PostgreSQL | a container in this stack | on another VM |
| Link | private Docker network, no TLS | across the LAN, TLS `verify-full` |
| `pg-ca.crt` | **not needed** | required, at `/opt/chuyennhahung/secrets/pg-ca.crt` |
| Host directory for the database | `data/postgres` (uid 70) | none |
| `setup-host.sh` argument | `local-db` | `external-db` |
| `DB_OVERLAY` for the runner | `local-db` | `external-db` (the default) |

Pick one before you start; the phases below say where they differ.

## How the pieces are deployed

The database and the app are **deployed separately**. This section shows who creates and
updates each part, and what happens to the database during a release.

### Who creates and updates what

| Part | Created by | Updated by | Where its state lives |
|---|---|---|---|
| `nginx` container | you, Phase 4 | you, by hand, when `deploy/nginx/` changes | none; logs in `logs/nginx` |
| `postgres` container | you, Phase 4 (the init script runs once) | you, by hand, for an image upgrade | `data/postgres` on the host |
| `app` container | the runner, at the first deploy | the runner, at every release | the database, and `data/app` when content is a JSON file |
| Database tables (schema) | the app, when it starts | the app, when it starts (migrations) | inside PostgreSQL |
| `/opt/chuyennhahung/.env` | you | you, then redeploy `app` | the file |
| The runner | you, Phase 5 | itself | none |

A release changes only the `app` container (and, through it, the tables). nginx and
PostgreSQL keep running.

### Flow 1 — One-time setup

1. **You**: prepare the VM, the directories and `.env` (Phases 1 to 2).
2. **You**: start PostgreSQL and nginx (Phase 4). On its first start PostgreSQL creates the
   role `cnh_app` and the databases from an empty data directory.
3. **You**: install the runner (Phase 5).
4. **The runner**: first deploy of `app` (Phase 6). The app creates the tables itself when it
   starts (Flow 3).
5. **You**: create the first admin, set up backups (Phase 7).

### Flow 2 — A release

```mermaid
flowchart TD
  PR["Pull request merged into main"] --> CI["CI: typecheck, lint, test, build"]
  CI -->|green| PLAN["plan: image tag = sha-commit"]
  PLAN --> BUILD["build the image on GitHub and push it to GHCR"]
  BUILD --> RUN["runner on the VM runs deploy.sh"]
  RUN --> PULL["docker login, compose pull app"]
  PULL --> UP["compose up -d --no-build --no-deps app"]
  UP --> WAIT{"target image running and /api/health OK within 180 s?"}
  WAIT -->|yes| OK["write .deployed-tag, prune dangling images, run goes green"]
  WAIT -->|no| BACK["print the app log, restart the previous tag, run goes red"]
```

Only one deploy runs at a time; a newer one waits. `nginx` and `postgres` are not touched.
`/api/health` only says the process is serving: it deliberately touches no database, so a
green deploy does **not** prove that migrations or Planner queries work. Run the
[smoke test](#smoke-test-after-a-deploy) after a release that adds migrations.

### Flow 3 — The database during a release

The container is never recreated. What changes is the tables, and only if the new release
carries new files in `db/migrations/`.

```mermaid
flowchart TD
  START["new app container starts"] --> LOCK["take the advisory lock, waiting at most 30 s"]
  LOCK -->|timeout| UNAVAIL["Planner answers 503, retried on the next request"]
  LOCK --> CHECK["compare schema_migrations with db/migrations"]
  CHECK -->|nothing new| SERVE["serve requests"]
  CHECK -->|new files| APPLY["apply each file in its own transaction and record it"]
  APPLY --> SERVE
  CHECK -->|an applied file was edited| REFUSE["refuse: Planner answers 503"]
```

- The first request after a release can be slower while migrations run.
- A migration failure does not stop the container; the Planner routes answer `503` and the
  log carries only an error code. Run `npm run db:migrate` in the `tools` container to see
  the real message.
- Migrations are plain SQL files, applied once and in order, and an applied file must never
  be edited.

### Flow 4 — Rolling back

| Situation | What to do | Note |
|---|---|---|
| A bug in the code, **no new migration** in the release | **Run workflow** with `tag` = the previous `sha-<commit>` | Fast and safe: only the image changes |
| The release **added migrations** and is bad | Prefer a fix forward: merge a corrected release. The old image can run on the new tables only if the migration was additive | Write migrations so the previous release still works on them |
| The new tables must be undone | Stop the app, restore the backup taken **before** the release ([deploy-operations](deploy-operations.md#backups-and-restore)), then deploy the old tag | The last resort; data written since the backup is lost |
| A file in `db/rollback/` | Applied by hand; it **drops tables**. Export first | Only for tables that migration just created |
| The health check fails during a deploy | Automatic: `deploy.sh` restarts the previous tag | It never touches the schema |

Take a backup (`backup.sh`) **before** any release that adds a file to `db/migrations/`.

### Flow 5 — Changing configuration

| Change | How |
|---|---|
| A runtime value in `/opt/chuyennhahung/.env` (a token, a password, Google keys) | Edit the file, then **Run workflow** with `tag` = the content of `.deployed-tag`: the same image, recreated with the new values (`docker restart` would keep the old environment) |
| The site address (`NEXT_PUBLIC_SITE_URL`, `DEV_SITE_URL`) | It is baked into the image: set both, then **Run workflow** with `tag` **empty** so a new image is built |
| `deploy/nginx/` or the `postgres` service | Not applied by a deploy; recreate that service by hand ([Updating](#updating-redeploying-and-rolling-back)) |
| A database password | Change it in PostgreSQL and in `.env`, then redeploy `app` ([deploy-operations](deploy-operations.md#rotating-secrets)) |

## Phase 0 — Prepare

- The VM's address, `<ip-app>` (a fixed IP or a DNS name), and root or `sudo` access.
- Admin rights on the GitHub repository (to register a runner and run workflows).
- The public origin of the site, for example `http://<ip-app>`. It is baked into the
  image at **build** time, so the repository variable `DEV_SITE_URL` and
  `NEXT_PUBLIC_SITE_URL` in `.env` must be the same value. `DEV_SITE_URL` defaults to
  `http://192.168.100.140`; set the variable if yours differs.
- `external-db` only: the DB VM's address `<ip-db>` and a way to copy a file to the app VM.

## Phase 1 — Blank VM

As root on the VM.

```bash
apt update && apt -y upgrade
apt install -y acl curl git ufw
ufw default deny incoming && ufw allow 22 && ufw allow 80 && ufw enable
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Install Docker Engine and the Compose v2 plugin from Docker's apt repository, then check:

```bash
docker compose version
```

`ufw` does not filter ports that Docker publishes; the stack publishes only nginx's
port 80. Add `443` when TLS is in front. On a LAN, restrict `22` and `80` to your subnet.

## Phase 2 — Code, directories and configuration

### Code and host directories

```bash
mkdir -p /opt/chuyennhahung
git clone https://github.com/doanviethung1009/chuyennhahung_planner.git /opt/chuyennhahung/src
```

Use the real repository URL, with a deploy key or a read-only token if it is private.
Then run the host setup **from the `deploy/` directory** (the path is relative to it):

```bash
cd /opt/chuyennhahung/src/deploy
./scripts/setup-host.sh local-db        # or: external-db
```

It prints `Host ready under /opt/chuyennhahung (<layout>).` and creates the bind-mount
directories with the owners the containers need. Do this **before** any `up`: Docker
creates a missing bind path as `root`, and a missing file path as a directory.

### The `.env` file

Create `/opt/chuyennhahung/.env` once. This block generates the secrets and writes them
to the file only; do not print the file or paste it anywhere.

```bash
umask 077
CNH=$(openssl rand -hex 24)
cat > /opt/chuyennhahung/.env <<EOF
NEXT_PUBLIC_SITE_URL=http://<ip-app>
TRUST_PROXY_HEADERS=true
ADMIN_API_TOKEN=$(openssl rand -base64 36)
POSTGRES_ADMIN_PASSWORD=$(openssl rand -hex 24)
CNH_APP_PASSWORD=$CNH
PLANNER_DATABASE_URL=postgres://cnh_app:$CNH@postgres:5432/cnh_planner
CONTENT_DATABASE_URL=postgres://cnh_app:$CNH@postgres:5432/cnh_content
GOOGLE_SIGNUP_ENABLED=false
EOF
```

- Run it **once**. PostgreSQL takes the password at its first start; running it again
  later makes the file and the database disagree.
- `CONTENT_DATABASE_URL` is optional; delete the line to keep content in a JSON file.
- `external-db`: drop the two `POSTGRES_*`/`CNH_*` password lines and use
  `PLANNER_DATABASE_URL=postgres://cnh_app:<password>@<ip-db>:5432/cnh_planner?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt`.
  Percent-encode `@ : / ? # &` in a password.
- To see which variables exist without showing values:
  `sed 's/=.*/=<hidden>/' /opt/chuyennhahung/.env`.

Group access for the runner is set in Phase 5, once the user exists.

## Phase 3 — The database

### Layout `local-db`

Nothing to install. On its first start the PostgreSQL container runs
`deploy/postgres/init/10-roles-and-databases.sh`, which creates the role `cnh_app` and
the databases `cnh_planner` and `cnh_content`. There is no TLS and **no `pg-ca.crt`**.

### Layout `external-db`

On the **DB VM**: install PostgreSQL 16 or 17, create the role and databases, make a
private CA and a server certificate whose Subject Alternative Name is `IP:<ip-db>`,
turn `ssl = on`, add one `hostssl cnh_planner cnh_app <ip-app>/32 scram-sha-256` line to
`pg_hba.conf`, and open port 5432 to `<ip-app>` only. The commands are in
[deploy-database → Step 2](deploy-database.md#step-2--encrypted-link-private-ca).
Then copy **only** the public `ca.crt` to the app VM **before** the first `up`:

```bash
install -m 644 ca.crt /opt/chuyennhahung/secrets/pg-ca.crt
ls -l /opt/chuyennhahung/secrets/pg-ca.crt      # must be a file, not a directory
```

Check the link from the app VM; it must end with `Verify return code: 0 (ok)`:

```bash
openssl s_client -starttls postgres -connect <ip-db>:5432 \
  -CAfile /opt/chuyennhahung/secrets/pg-ca.crt </dev/null 2>&1 | grep 'Verify return code'
```

## Phase 4 — Start nginx and PostgreSQL

Run every command from `/opt/chuyennhahung/src/deploy`: `--project-directory .` makes
Compose use the files of that directory, and `--env-file` points it at the secrets.

```bash
cd /opt/chuyennhahung/src/deploy
docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml up -d postgres nginx
```

`external-db`: drop `--profile local-db` and start only nginx:

```bash
docker compose --project-directory . --env-file /opt/chuyennhahung/.env -f compose.yml up -d nginx
```

Wait about 30 seconds, then check:

```bash
# postgres and nginx must be (healthy)
docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml ps
# must list cnh_planner and cnh_content, owner cnh_app
docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml exec postgres psql -U postgres -c '\l'
# must answer 200 and "ok"
curl -i http://localhost/nginx-health
```

To type less, you may define a shortcut; it exists only in the shell where you ran it,
and the rest of this document writes `dc` for it where the command is repeated:

```bash
dc() { docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml "$@"; }
```

Running `psql` in the first seconds fails with a socket error: PostgreSQL is still
initialising on a temporary server. Wait and repeat. The warning
`sh: locale: not found` is harmless on Alpine. Until the app exists,
`curl http://localhost/` answers `503` with the maintenance page; that is expected.

## Phase 5 — The runner

Do the steps in order. Keep the runner in `/home/cnh-runner/actions-runner`, **never**
inside `/opt/chuyennhahung` (this includes the repository checkout under it): the runner
must be able to list every parent directory of its own folder, and `cnh-runner`
deliberately has traverse-only access to `/opt/chuyennhahung` (step 2). Run from there it
stops with `Access to the path '/opt/chuyennhahung' is denied`. Do not widen the ACL to
fix it; move the runner.

### Step 1 — A user for it

No password, no shell login of its own. Run as root:

```bash
adduser --disabled-password --gecos "" cnh-runner
usermod -aG docker cnh-runner
id cnh-runner
```

`id` must list the group `docker`, which is root-equivalent on this VM. Use the account
for the runner only.

### Step 2 — Minimum access to the stack

```bash
setfacl -m u:cnh-runner:--x /opt/chuyennhahung
touch /opt/chuyennhahung/.deployed-tag && chown cnh-runner /opt/chuyennhahung/.deployed-tag
chgrp cnh-runner /opt/chuyennhahung/.env && chmod 640 /opt/chuyennhahung/.env
sudo -u cnh-runner test -r /opt/chuyennhahung/.env && echo readable
sudo -u cnh-runner docker ps > /dev/null && echo docker-ok
```

The directory gets traverse only, so the runner cannot replace `.env`. Both checks must
print their word.

### Step 3 — Download and register

In GitHub: **Settings → Actions → Runners → New self-hosted runner → Linux x64**. Run the
page's download commands as `cnh-runner`, one command at a time:

```bash
sudo -iu cnh-runner
mkdir -p ~/actions-runner && cd ~/actions-runner
pwd
```

`pwd` must print `/home/cnh-runner/actions-runner`. Paste the page's download commands
there until `ls config.sh run.sh svc.sh` lists all three files. The page also shows a
**single-use registration token**: type it only in your own terminal, never in a chat or a
file.

```bash
./config.sh --url https://github.com/<owner>/<repo> --token <TOKEN-FROM-THE-PAGE> \
  --labels cnh-dev --name cnh-dev-vm
```

Use `--labels cnh-dev` exactly: the workflow selects the runner with
`runs-on: [self-hosted, linux, cnh-dev]`, so a runner without the `cnh-dev` label never
receives the job and the run stays `queued` for ever. If the page's default command was
used and the label is missing, add it later (see the troubleshooting table and the check
below Step 6). The runner name defaults to the host name when you press Enter; that is
fine, and the unit name in step 5 follows it.

When it ends with `Settings Saved`, leave the `cnh-runner` shell:

```bash
exit
```

### Step 4 — Install it as a service

As root:

```bash
cd /home/cnh-runner/actions-runner
./svc.sh install cnh-runner
./svc.sh start
./svc.sh status
systemctl list-units 'actions.runner.*' --no-legend
```

Continue only when `status` reports `active (running)`. The last command prints the
service's **unit name**, explained in the next step.

### Step 5 — Tell it the layout

**What a unit is.** systemd, the service manager of Linux, describes every service it runs
in a configuration file called a *unit*; its name ends in `.service`. When you ran
`./svc.sh install cnh-runner`, GitHub's script created a unit for the runner, so that the
runner starts at boot and restarts on failure. Its name is built as
`actions.runner.<owner>-<repo>.<runner-name>.service`; for this repository and the runner
name used above it should be
`actions.runner.doanviethung1009-chuyennhahung_planner.cnh-dev-vm.service`. Keep the real
one in a variable; it lasts only for the current shell, so repeat these two lines in a new
shell before using `$UNIT`:

```bash
UNIT=$(systemctl list-units 'actions.runner.*' --no-legend | awk '{print $1}')
echo "$UNIT"
```

`echo` must print exactly one name; if it prints nothing, the service from step 4 is not
installed.

`deploy.sh` reads two settings from the runner's environment: `STACK_DIR` (where `.env` and
`.deployed-tag` live) and `DB_OVERLAY` (`local-db` or `external-db`; the default is
`external-db`). They are set in a systemd drop-in: a file in `$UNIT.d/` is merged over the
unit that `svc.sh` generated, so running `svc.sh` again does not overwrite it. Write it as
root, with `DB_OVERLAY=external-db` for the other layout:

```bash
mkdir -p /etc/systemd/system/$UNIT.d
```

```bash
cat > /etc/systemd/system/$UNIT.d/environment.conf <<'EOF'
[Service]
Environment=STACK_DIR=/opt/chuyennhahung
Environment=DB_OVERLAY=local-db
EOF
```

```bash
systemctl daemon-reload && systemctl restart $UNIT
systemctl show $UNIT -p Environment
```

The `cat` writes every line up to the lone `EOF` (which must start at the left margin, with
nothing before it) into the file; the quotes around `'EOF'` stop the shell from expanding
anything inside. `daemon-reload` makes systemd re-read the unit files and `restart` applies
them. The last command must show both variables. Define them in **one** place only: the
drop-in of [deploy-runner](deploy-runner.md) also sets them, and a later file overrides an
earlier one.

### Step 6 — Harden the unit

This step is **optional** and best done **after** the first successful deploy (Phase 6):
the runner works without it, and a restrictive setting can stop a deploy in a way that is
hard to spot. Skip it now, deploy, then come back, apply it and run **Deploy dev** again to
prove it still works. `deploy.sh` runs `docker login`, which writes
`/home/cnh-runner/.docker/config.json`; that directory is therefore in `ReadWritePaths`
below, and it must exist first. Use the `$UNIT` variable from step 5, as root:

```bash
install -d -m 700 -o cnh-runner -g cnh-runner /home/cnh-runner/.docker
```

```bash
cat > /etc/systemd/system/$UNIT.d/hardening.conf <<'EOF'
[Service]
PrivateTmp=true
ProtectHome=read-only
ReadWritePaths=/home/cnh-runner/actions-runner /home/cnh-runner/.docker /opt/chuyennhahung
ProtectKernelTunables=true
ProtectControlGroups=true
Restart=on-failure
RestartSec=10
EOF
```

```bash
systemctl daemon-reload && systemctl restart $UNIT
systemctl status $UNIT --no-pager | head -5
```

| Setting | Effect on the runner process |
|---|---|
| `PrivateTmp=true` | its own private `/tmp`, invisible to other services |
| `ProtectHome=read-only` | `/home` is read-only for it … |
| `ReadWritePaths=…` | … except these paths: its own folder, `/home/cnh-runner/.docker` (the registry login) and `/opt/chuyennhahung` (it writes `.deployed-tag` there) |
| `ProtectKernelTunables=true`, `ProtectControlGroups=true` | `/proc/sys`, `/sys` and the cgroup tree are read-only |
| `Restart=on-failure`, `RestartSec=10` | restart 10 s after a crash |

It confines the runner process only. It does **not** contain what the runner does through
Docker: a member of the `docker` group is root-equivalent, so the real boundary is who may
push workflows (see [deploy-runner](deploy-runner.md)). Do not add `NoNewPrivileges`,
`ProtectSystem=strict` or `PrivateDevices` untested: Docker needs its socket and cgroups.

The runner shows **Idle** with the label `cnh-dev` on the GitHub Runners page. Check the
labels from any machine that has `gh` logged in; the output must contain `cnh-dev`:

```bash
gh api repos/<owner>/<repo>/actions/runners --jq '.runners[]|[.id,.name,.status,([.labels[].name]|join(","))]|@tsv'
```

If it does not, add the label — **but only after Step 5**, because as soon as the runner
has the label, any waiting job starts, and without `DB_OVERLAY=local-db` it would deploy
with the `external-db` defaults (and Docker would create a directory named `pg-ca.crt`).
In GitHub: **Settings → Actions → Runners →** the runner **→ Labels**, or:

```bash
gh api -X POST repos/<owner>/<repo>/actions/runners/<runner-id>/labels -f 'labels[]=cnh-dev'
```

## Phase 6 — First deploy

1. Open **Actions → Deploy dev**. A run that was waiting for a runner starts by itself;
   otherwise **Run workflow** on `main` with `tag` empty (it builds on GitHub, then the VM
   job deploys).
2. On the VM:
   ```bash
   cat /opt/chuyennhahung/.deployed-tag               # sha-<commit>
   curl -i http://<ip-app>/api/health                 # 200 {"status":"ok"}
   cd /opt/chuyennhahung/src/deploy      # the compose files live here
   docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml ps    # app, nginx, postgres healthy
   ```
3. Check that PostgreSQL was not restarted by the deploy: its `STATUS` age in `dc ps`
   must not drop to seconds after a later deploy. If it does, see
   [Limits](#what-has-been-verified).

## Phase 7 — After the first deploy

> **Define `dc` first.** `dc` (and every `docker compose` command in this phase and the
> troubleshooting table) only works in a shell where you ran the one-line function from
> [Phase 4](#phase-4--start-nginx-and-postgresql) in this session; in a new shell or a new SSH
> login it is gone. Without `--env-file /opt/chuyennhahung/.env`, a bare `docker compose`
> fails with *required variable CNH_APP_PASSWORD is missing*.

- **First admin.** With the service token, through nginx (the app publishes no port of
  its own). Keep the `temporaryPassword` from the response; it is shown once.
  ```bash
  TOKEN=$(grep '^ADMIN_API_TOKEN=' /opt/chuyennhahung/.env | cut -d= -f2-)
  curl -s -X POST http://localhost/api/admin/planner/users \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"handle":"admin","displayName":"Admin","email":"you@example.com","role":"admin"}'
  ```
  Sign in at `/dang-nhap?returnTo=/quan-tri`, then set a new password at `/doi-mat-khau`.
  The alternative, `npm run admin:create` in the `tools` container, builds an image on
  the VM and needs `APP_SRC=..` in front of the `docker compose` command; see
  [usage → Sign in as admin](usage.md#sign-in-as-admin).
- **Backups.** `crontab -e` →
  `15 3 * * * cd /opt/chuyennhahung/src/deploy && ./scripts/backup.sh local-db`.
  Copy `/opt/chuyennhahung/backups` off the VM. With `external-db`, dump on the DB VM too.
  Restore, logs, secret rotation and cleanup are in [deploy-operations](deploy-operations.md).
- **Later.** Google sign-in is hidden for now on purpose: it needs both `GOOGLE_CLIENT_ID`
  and `GOOGLE_CLIENT_SECRET`, and Google accepts a plain-`http://` redirect URI only for
  `localhost`, so it cannot work on `http://<ip-app>`. That is why it works on your
  computer and not here. First TLS in front of nginx; then set `DEV_SITE_URL` and `NEXT_PUBLIC_SITE_URL` to
  the https origin and redeploy; then Google sign-in. The owner's pre-launch list is in
  [usage → Before going live](usage.md#before-going-live--owner-actions).

## Smoke test after a deploy

Run it after the first deploy, after every release you care about, and after a restore or a
secret rotation. From any machine that can reach the VM (replace `<ip-app>`):

```bash
for p in / /en /chuyen-di-choi /kham-pha /ban-do /len-lich-trinh /thiet-ke-chuyen-di /dang-nhap /robots.txt /sitemap.xml /api/health; do
  printf '%-22s' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "http://<ip-app>$p"
done
```

Every line must end in `200`. A `404` or an empty page on `/chuyen-di-choi` or `/kham-pha`
means the content store is empty: see
[usage → Seed the static stories](usage.md#seed-the-static-stories-into-the-content-store).

Then check by hand in a browser:

1. **Security headers.** `curl -sI http://<ip-app>/` shows `Content-Security-Policy`,
   `X-Frame-Options` and `X-Content-Type-Options`.
2. **Sign-in.** Sign in with the admin account, open `/quan-tri`, and see the user list.
3. **Planner.** Create a trip, add a day and an activity, reload: it is still there. Open
   its share link in a private window: it shows the trip without signing in. The Planner
   has no in-browser editor yet, so to check it with `curl`, send every cookie-authenticated
   write with `Origin` set to the value of `NEXT_PUBLIC_SITE_URL` (read it with
   `docker exec chuyennhahung-app-1 printenv NEXT_PUBLIC_SITE_URL`). On the dev VM that is
   `http://192-168-100-140.nip.io`, **not** the IP; an `Origin` of the IP is refused with
   `403 a cross-site POST is refused`. Sign-in alone needs no `Origin`.
4. **Both languages.** `/` and `/en` render, and the language switch keeps the page.
5. **The database survived the deploy.**
   ```bash
   docker inspect -f '{{.State.StartedAt}}' chuyennhahung-postgres-1
   cat /opt/chuyennhahung/.deployed-tag
   ```
   PostgreSQL's start time must be older than this deploy; a deploy must not restart it.
6. **Rollback works.** Once, on a quiet day: **Run workflow** on `main` with `tag` set to an
   older `sha-<commit>`; the run goes green and `.deployed-tag` shows that tag. Then deploy
   the latest again.

## Updating, redeploying and rolling back

| Goal | How |
|---|---|
| Release | Merge a pull request into `main`; watch **Actions → Deploy dev** |
| Redeploy or roll back by hand | **Run workflow** on `main` with `tag` = `sha-<commit>` (no build) |
| Pause deploys | `systemctl stop <unit>`; jobs wait in the queue |
| Change `deploy/nginx/` or the postgres service | Not applied by a deploy: run the Phase 4 command with `up -d nginx` (or `restart nginx`) yourself |
| Change `.env` | Edit it, then run **Deploy dev** again so `app` restarts with it |

The run succeeds only if `app` reports healthy on the target image within 180 s;
otherwise the previous tag is restored and the run fails. A rollback does **not** undo
database migrations. Do not mix `up -d --build` by hand with the runner for one
release: the runner expects the GHCR image.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `./deploy/scripts/setup-host.sh: command not found` | You are already in `deploy/`; run `./scripts/setup-host.sh <layout>` |
| `setfacl: command not found` | `apt install -y acl` |
| `unknown user cnh-runner`, `invalid group: cnh-runner` | The user is not created yet (Phase 5 step 1) |
| `couldn't find env file: /opt/chuyennhahung/.env` | The file is missing (Phase 2), or `cnh-runner` cannot read it (Phase 5 step 2) |
| `psql … .s.PGSQL.5432 failed` right after the first `up` | PostgreSQL is still initialising; wait 15 s and retry |
| `sh: locale: not found` in the postgres log | Harmless on Alpine |
| `Access to the path '/opt/chuyennhahung' is denied` when running the runner | The runner folder is under `/opt/chuyennhahung`; move it to `/home/cnh-runner/actions-runner` and `chown -R cnh-runner:cnh-runner` it (Phase 5) |
| `compose file "/opt/chuyennhahung/compose.yml" is invalid … no such file` | You are not in `/opt/chuyennhahung/src/deploy`; `cd` there first (the compose files are in the checkout, not in `/opt/chuyennhahung`) |
| A **Deploy dev** run stays `queued` or `pending` for ever | No online runner has the label `cnh-dev` (Phase 5, check below Step 6); or an older run holds the `deploy-dev` concurrency group and this one waits behind it |
| `./config.sh: No such file` | The runner archive was not downloaded; Phase 5 step 3 |
| The first `up` created a directory named `pg-ca.crt` | The file did not exist before `up` (`external-db`); remove the directory, copy the CA, `up` again |
| `http://<ip-app>/` shows the maintenance page | Normal before the first deploy; afterwards check `dc ps` and the app logs |
| The deploy fails on the `.env` read | `chgrp cnh-runner` / `chmod 640` (Phase 5 step 2) |
| The registry pull is denied | In GitHub → Packages → `chuyennhahung-app` → settings, grant this repository read access |
| Planner routes answer `503` | The database is unreachable or refused the login: check `dc ps`, the URL and the password |
| An admin mutation, or a Planner write with a cookie, answers `403` | `NEXT_PUBLIC_SITE_URL` is not the exact origin of the page (scheme, host, port); with `curl`, `Origin` must equal it, and on the dev VM that is the `nip.io` host, not the IP |
| PostgreSQL rejects the password after you regenerated `.env` | It keeps the password from its first start; with no real data yet, stop it and empty `/opt/chuyennhahung/data/postgres`, then `up` again |

## What has been verified

On the dev VM on 2026-11-15, with the owner's real output: `setup-host.sh local-db`,
creating `.env` with mode 640 and group `cnh-runner`, starting PostgreSQL and nginx (the
init script created the role and both databases, both containers healthy, `nginx-health`
returned 200), the `cnh-runner` user in the `docker` group, registering the runner, running
it as a service with the `environment.conf` drop-in, and a **first deploy through the
runner**: the workflow went green, `/api/health` answered 200 through nginx, `.deployed-tag`
held the commit and the `app` container ran the registry image and was healthy.

Two things that deploy taught, both now handled in this document: the runner registered
without the `cnh-dev` label, so the job stayed queued until the label was added and the
service restarted; and `app`'s `depends_on: postgres` made Compose **recreate the
PostgreSQL container** on that first deploy (its `CREATED` time was seconds, not hours),
because the stack had been started from another checkout path. Later deploys did not do
it again: PostgreSQL kept the same `StartedAt` across the next two deploys, one without and
one with `--no-deps`. So the flag is a **safeguard**, tested with a fake Docker, and the VM
has **not** shown it making a difference; it protects against the database service being
redefined in a later release. Check step 5 of the smoke test after a release that touches
`deploy/compose.yml`.

**Not verified yet:** the unit hardening, creating the admin, `backup.sh` (its Compose call
was wrong for this layout and is fixed and tested with a fake Docker, but has not run on the
VM), every restore and rotation step in [deploy-operations](deploy-operations.md), the smoke
test itself, and every `external-db` step (CA, TLS, `pg_hba.conf`). Treat them as
unconfirmed until you have run them, and fix this document where reality differs.

## Related documents

- [deploy-operations](deploy-operations.md) — day-2: logs, restart, restore, secret rotation, cleanup, upgrades, incidents.
- [docker-deploy](features/docker-deploy.md) — the stack, its files, bind mounts, manual update.
- [deploy-runner](deploy-runner.md) — the runner in depth: why a service, what you accept, hardening.
- [auto-deploy-dev](features/auto-deploy-dev.md) and [ADR 0016](adr/0016-auto-deploy-dev.md) — the workflow and the decision.
- [deploy-database](deploy-database.md) — move existing JSON data to PostgreSQL, TLS, import.
- [usage → Deploy](usage.md#deploy) — reference, environment variables, admin and Google setup.
