# Deploy operations — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

What to do **after** the app is running: look at it, read its logs, restart it, back it up
and restore it, rotate its secrets, keep the disk from filling, upgrade it, and react when
it breaks. It assumes the single-VM `local-db` layout built by
[deploy-runbook](deploy-runbook.md); where `external-db` differs, the database part runs on
the DB VM instead.

🇻🇳 Bản tiếng Việt: [deploy-operations.vi.md](deploy-operations.vi.md)

None of the commands below has been run on the real VM yet, except where
[deploy-runbook](deploy-runbook.md#what-has-been-verified) says so. Try each once on a
quiet day, and correct this document where it differs.

## Routine checks

| How often | Check | Command or place |
|---|---|---|
| Daily | The site answers | `curl -s -o /dev/null -w '%{http_code}\n' http://<ip-app>/api/health` → `200` |
| Daily | Three containers healthy | `docker ps --format '{{.Names}}  {{.Status}}'` |
| Daily | Last backup exists and is not empty | `ls -lh /opt/chuyennhahung/backups \| tail -3` |
| Weekly | Disk | `df -h /opt /var/lib/docker` |
| Weekly | Runner is Idle, last deploy green | GitHub → Settings → Actions → Runners; Actions → Deploy dev |
| Monthly | A restore actually works | [Restore PostgreSQL](#restore-postgresql-local-db) into a scratch database |

## Logs

The container names are `chuyennhahung-app-1`, `chuyennhahung-nginx-1` and
`chuyennhahung-postgres-1`.

```bash
docker logs --tail 100 chuyennhahung-app-1
docker logs -f chuyennhahung-app-1                 # follow; Ctrl-C to stop
docker logs --tail 100 chuyennhahung-postgres-1
tail -n 100 /opt/chuyennhahung/logs/nginx/access.log
tail -n 100 /opt/chuyennhahung/logs/nginx/error.log
```

The runner is a systemd service: `journalctl -u <unit> -n 100 --no-pager` (the unit name is
in [deploy-runbook](deploy-runbook.md), Phase 5). The log of one deploy is in GitHub under
**Actions → Deploy dev → the run**. Read a log before you paste it anywhere: it can hold
addresses and, after an error, fragments of a request.

## Restart and stop

| Goal | Command |
|---|---|
| Restart one container | `docker restart chuyennhahung-app-1` (or `-nginx-1`, `-postgres-1`) |
| Take the site down for maintenance | `docker stop chuyennhahung-app-1`; nginx then serves the maintenance page (503). Bring it back with `docker start chuyennhahung-app-1` |
| Apply a changed `.env` | **Not** `docker restart` (it keeps the old environment). Run **Deploy dev** on `main` with `tag` = the content of `/opt/chuyennhahung/.deployed-tag`; the container is recreated with the new values |
| Stop everything | `docker stop chuyennhahung-app-1 chuyennhahung-nginx-1 chuyennhahung-postgres-1` |
| Start everything after a stop | `docker start chuyennhahung-postgres-1 chuyennhahung-nginx-1 chuyennhahung-app-1` |

Containers have `restart: unless-stopped`, so they return after a reboot or a Docker
restart, provided the Docker service is enabled (`systemctl is-enabled docker`). After a
reboot, check `docker ps` and that the runner service is `active (running)`.

## Backups and restore

### Taking backups

`deploy/scripts/backup.sh local-db` writes `/opt/chuyennhahung/backups/<date-time>/` with
`app-data.tgz` (the content store directory) and, for `local-db`, `cnh_planner.dump` and
`cnh_content.dump` (`pg_dump --format=custom`). It reads `/opt/chuyennhahung/.env` for
Compose, refuses to leave an empty dump behind, and removes backup directories older than 14
days. Run it from cron as root (the runbook, Phase 7, shows the line) and try it once by
hand:

```bash
cd /opt/chuyennhahung/src/deploy && ./scripts/backup.sh local-db
ls -lh /opt/chuyennhahung/backups/*/
```

The dumps hold password hashes and token digests: keep the directory owner-only. A backup
on the same disk does not survive the disk. **Copy `/opt/chuyennhahung/backups` to another
machine**, for example with `rsync` from your own computer, and keep at least one copy that
the VM cannot overwrite. For `external-db`, the script archives only the content store;
dump the databases on the DB VM with its own cron.

### Restore PostgreSQL (local-db)

Always rehearse into a scratch database first (`createdb`, `pg_restore -d scratch`), then do
it for real. For a real restore, stop the app so nothing writes during it:

```bash
docker stop chuyennhahung-app-1
docker exec -i chuyennhahung-postgres-1 pg_restore -U postgres --clean --if-exists -d cnh_planner < /opt/chuyennhahung/backups/<stamp>/cnh_planner.dump
docker exec -i chuyennhahung-postgres-1 pg_restore -U postgres --clean --if-exists -d cnh_content < /opt/chuyennhahung/backups/<stamp>/cnh_content.dump
docker start chuyennhahung-app-1
```

`--clean --if-exists` drops the objects before recreating them, so the data written after
`<stamp>` is lost. `pg_restore` may print warnings; read them, and finish with the
[smoke test](deploy-runbook.md#smoke-test-after-a-deploy).

### Restore the content store

For the files in `data/app` (used when `CONTENT_DATABASE_URL` is empty):

```bash
docker stop chuyennhahung-app-1
tar -xzf /opt/chuyennhahung/backups/<stamp>/app-data.tgz -C /opt/chuyennhahung/data
chown -R 1000:1000 /opt/chuyennhahung/data/app
docker start chuyennhahung-app-1
```

## Rotating secrets

Rotate after any suspected leak, when someone who knew a secret leaves, and on a schedule
you choose. Never type a new secret into a chat.

### ADMIN_API_TOKEN

Generate a new value into `.env`, then recreate the app so it reads it:

```bash
NEW=$(openssl rand -base64 36)
sed -i "s|^ADMIN_API_TOKEN=.*|ADMIN_API_TOKEN=$NEW|" /opt/chuyennhahung/.env
```

Then run **Deploy dev** with `tag` = the content of `.deployed-tag`. Anyone holding the old
token is locked out.

### Database passwords

Change the role in PostgreSQL **and** in `.env`; they must match. For the application role:

```bash
NEW=$(openssl rand -hex 24)
docker exec chuyennhahung-postgres-1 psql -U postgres -c "ALTER ROLE cnh_app PASSWORD '$NEW'"
sed -i "s/^CNH_APP_PASSWORD=.*/CNH_APP_PASSWORD=$NEW/; s#cnh_app:[^@]*@#cnh_app:$NEW@#" /opt/chuyennhahung/.env
```

Then run **Deploy dev** as above. `POSTGRES_ADMIN_PASSWORD` is used only when the cluster is
first created, so changing `.env` alone changes nothing: use `ALTER ROLE postgres PASSWORD
…` as well, and keep both in step.

### Registry, runner and Google

- The registry login uses the job's own token for one pull; there is nothing to rotate.
- The runner's registration token is single use. To re-register: stop the service, run
  `./config.sh remove` with a removal token from GitHub, then register again
  ([deploy-runner](deploy-runner.md)).
- `GOOGLE_CLIENT_SECRET`: create a new secret in Google Cloud Console, put it in `.env`,
  run **Deploy dev**, then delete the old one.

After any rotation, run the smoke test.

## Disk and cleanup

```bash
df -h /opt /var/lib/docker
docker system df
du -sh /opt/chuyennhahung/data/* /opt/chuyennhahung/logs /opt/chuyennhahung/backups
```

- **Old images.** `deploy.sh` prunes only dangling images; every deployed tag stays. Remove
  the ones no container uses: `docker image prune -a` (the running app, nginx and postgres
  images are kept). A rollback to a removed tag pulls it from the registry again.
- **Docker logs.** By default container logs grow without limit. Cap them for all new
  containers in `/etc/docker/daemon.json`, then `systemctl restart docker` and recreate the
  containers (a deploy recreates `app`):
  ```json
  { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
  ```
- **nginx logs** live on the host (`logs/nginx/access.log`, `error.log`).
  [`deploy/logrotate/chuyennhahung`](../deploy/logrotate/chuyennhahung) keeps the access
  log 14 days and the error log 30 days; `deploy/scripts/setup-host.sh` installs it to
  `/etc/logrotate.d/`. The access log uses a custom format that records the normalised path
  (no query string), masks share-token paths (`/chia-se/`, `/en/shared/`, `/api/shared/`) and
  never records `Cookie`, `Authorization` or `Referer`. nginx can still write a raw request
  line into `error.log`, so treat that file as sensitive. Reload nginx after changing the
  format. Containers also cap their own logs (10 MB × 3) and memory
  (`APP_MEM_LIMIT`, `POSTGRES_MEM_LIMIT`) in the compose files. `limit_req` is keyed on the client address: behind another proxy or a tunnel add `set_real_ip_from` first, or every client shares one bucket. Not yet verified on a VM.
- **Backups** older than 14 days are removed by the script; the copy off the VM is yours to
  prune.

## Upgrades

- **The app** is released by merging into `main` ([deploy-runbook](deploy-runbook.md)).
- **nginx and PostgreSQL** images are pinned to a minor tag (`nginx:1.27-alpine`,
  `postgres:17-alpine`). Take a backup first; then, from `/opt/chuyennhahung/src/deploy`,
  `docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml pull postgres nginx`
  and the same command with `up -d postgres nginx`. This recreates them: expect a short
  gap. A **major** PostgreSQL version (17 → 18) cannot be done by changing the tag on an
  existing data directory: dump, start a new cluster, restore.
- **The OS and Docker Engine**: `apt update && apt upgrade` in a quiet hour, reboot if the
  kernel changed, then check `docker ps` and the runner. Consider `unattended-upgrades`
  for security fixes.
- **The runner** updates itself. If it stalls, stop the service, extract the new release in
  its folder and start it again.

## When something breaks

| Symptom | First look | Likely cause and next step |
|---|---|---|
| The site shows the maintenance page (503) | `docker ps` | `app` is stopped or unhealthy: `docker logs --tail 100 chuyennhahung-app-1`, then `docker start chuyennhahung-app-1` |
| The site does not answer at all | `docker ps`, `ufw status` | `nginx` is down, or the firewall blocks 80: `docker start chuyennhahung-nginx-1` |
| Planner pages answer 503 | `docker logs --tail 100 chuyennhahung-postgres-1` | The database is down or the password no longer matches `.env` |
| A deploy failed and rolled back | Actions → Deploy dev → the run | The log shows the health check and the app's last lines; fix, merge again. A rollback does not undo migrations |
| A deploy stays queued | Runners page | The runner is offline or lacks the `cnh-dev` label |
| `No space left on device` | `df -h`, `docker system df` | [Disk and cleanup](#disk-and-cleanup) |
| Suspected leak of a secret | — | [Rotate](#rotating-secrets) it, then read the nginx and app logs around the time |
| The data is wrong or gone | `ls /opt/chuyennhahung/backups` | [Restore](#backups-and-restore) the last good backup |

## Limits

- No monitoring and no alerting: a person has to look. A free uptime check on
  `/api/health` is the cheapest first step.
- One VM, one replica, and backups on the same disk until you copy them off.
- Plain HTTP on an IP. TLS and a domain come first; see the last bullet of Phase 7 in
  [deploy-runbook](deploy-runbook.md).
- The restore, rotation, logrotate and upgrade steps above are unverified on the VM.
