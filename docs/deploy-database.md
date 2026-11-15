# Deploy the database — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

A step-by-step runbook to move the app from the JSON files in `.data/` to a real
PostgreSQL server on a **separate VM**, with the existing data loaded. It ties
together what [usage.md](usage.md) and
[ADR 0009](adr/0009-postgres-persistence.md) /
[ADR 0013](adr/0013-content-on-postgres-tables.md) describe in pieces. Nothing
here is run for you: every privileged step is done by the owner.

🇻🇳 Bản tiếng Việt: [deploy-database.vi.md](deploy-database.vi.md)

## What moves and what stays

| Data | Where it lives now | After this runbook |
|---|---|---|
| Planner: accounts, sessions, trips, community reviews, restrictions | `.data/planner.json` | PostgreSQL (`PLANNER_DATABASE_URL`) |
| Travel Content edited in the admin: places, stories, collections, reviews, templates | `.data/travel-content.json` | PostgreSQL (`CONTENT_DATABASE_URL`) |
| Fixed site content: `src/content/*.ts`, `messages/*.json`, `site.ts` | the repository | unchanged — built into the app, never a runtime file |

Both stores may use the same database (`cnh`): their tables do not overlap.
Once a URL is set the app **never falls back** to the file; a database outage is
a `503`, not stale data. `.data/` is left untouched and is the rollback.

## Before you start

- A PostgreSQL 16 or 17 server on the DB VM, and shell access with `sudo`.
- The DB VM's IP (`<DB_IP>`) and the app VM's IP (`<APP_IP>`, here `192.168.100.140`).
- A **fresh backup** of `.data/` (copy the folder; it holds password hashes and
  emails — keep it owner-readable only).
- On the machine that runs the import: a checkout with dev dependencies
  (`npm ci`), because the scripts run through `vite-node`.
- Passwords are typed only in your own terminal. Never in chat, never in a file
  you commit, never in a command line you paste elsewhere.

## Step 1 — Create the role and the database

On the DB VM:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE cnh_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password cnh_app
CREATE DATABASE cnh OWNER cnh_app;
REVOKE ALL ON DATABASE cnh FROM PUBLIC;
```

`\password` asks for the password interactively. The role owns the database
because the app applies migrations at startup (accepted risk, ADR 0009 §5).

## Step 2 — Encrypted link (private CA)

ADR 0009 §5 requires TLS with full verification across machines, and the `pg`
driver in use treats `require`, `prefer` and `verify-ca` as `verify-full`. With no
public CA, make a private one **on the DB VM**. Replace `<DB_IP>`.

```bash
sudo install -d -m 750 -o postgres -g postgres /etc/postgresql/ssl
cd /etc/postgresql/ssl

# CA: keep ca.key on this VM only, readable by root.
sudo openssl genrsa -out ca.key 4096
sudo openssl req -x509 -new -key ca.key -sha256 -days 3650 \
  -subj "/CN=Chuyen Nha Hung DB CA" -out ca.crt

# Server certificate whose SAN contains the IP the URL will use.
sudo openssl genrsa -out server.key 2048
sudo openssl req -new -key server.key -subj "/CN=<DB_IP>" -out server.csr
echo "subjectAltName=IP:<DB_IP>" | sudo tee san.ext >/dev/null
sudo openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 825 -sha256 -extfile san.ext

sudo chown postgres:postgres server.key server.crt
sudo chmod 600 server.key
sudo chmod 600 ca.key
```

In `postgresql.conf` (path: `/etc/postgresql/<version>/main/`):

```conf
listen_addresses = 'localhost,<DB_IP>'
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file  = '/etc/postgresql/ssl/server.key'
```

In `pg_hba.conf`, one line for each client IP and **no** plain `host` line for
the same role. Add this Mac's IP only while you import:

```conf
hostssl  cnh  cnh_app  <APP_IP>/32  scram-sha-256
hostssl  cnh  cnh_app  <MAC_IP>/32  scram-sha-256
```

```bash
sudo systemctl restart postgresql
sudo ufw allow from <APP_IP> to any port 5432 proto tcp
sudo ufw allow from <MAC_IP> to any port 5432 proto tcp
```

Copy only the **public** `ca.crt` to the places that connect: the app VM at
`/opt/chuyennhahung/secrets/pg-ca.crt` (`chmod 644`) and this Mac, e.g. `~/cnh-pg-ca.crt`.
`ca.key` and `server.key` never leave the DB VM.

**Without TLS.** A plain LAN link contradicts ADR 0009 §5. It is allowed only
after the owner accepts it in writing as an amendment to that ADR, in both
languages. Until then, use this step.

## Step 3 — Check the connection

From this Mac, with the password typed into the shell (no echo):

```bash
read -rs DB_PASS; echo
export PLANNER_DATABASE_URL="postgres://cnh_app:${DB_PASS}@<DB_IP>:5432/cnh?sslmode=verify-full&sslrootcert=$HOME/cnh-pg-ca.crt"
export CONTENT_DATABASE_URL="$PLANNER_DATABASE_URL"
unset DB_PASS
psql "$PLANNER_DATABASE_URL" -c 'select 1'
```

A password with `@ : / ? # %` must be percent-encoded in the URL. The
variables exist only in this terminal session and are never written to a file.
Failures: `certificate verify failed` means the SAN lacks `<DB_IP>` or the CA is
the wrong file; a timeout means the firewall or `listen_addresses`; `no
pg_hba.conf entry` means the line above is missing for this client's IP.

## Step 4 — Migrate

In the **same terminal**:

```bash
npm run db:migrate
```

Expect migrations `0001` to `0008` applied. Then check the review status
constraint includes `held` (migration `0007`):

```bash
psql "$PLANNER_DATABASE_URL" -tA -c \
  "select pg_get_constraintdef(oid) from pg_constraint where conname = 'community_reviews_status_check'"
```

If a migration fails, stop and read the exact message; do not edit an applied
file. Roll back by hand from `db/rollback/` (it drops tables — export first).

## Step 5 — Import the existing data

1. Stop everything that uses the JSON files (dev server, the old container).
2. Use a copy of the files as the source, not the live ones.
3. Imports refuse non-empty tables; never truncate real data to make room.

```bash
export TRAVEL_CONTENT_AUTOSEED=false
npm run planner:import -- /path/to/backup/planner.json
npm run content:import -- /path/to/backup/travel-content.json
```

`planner:import` reads the content catalog to validate places, so run it with the
same content source as the app. If it complains, import the content first.

## Step 6 — Verify

Compare record counts with the JSON, without printing row contents:

```bash
node -e 'const d=require(process.argv[1]);for(const k in d)console.log(k,Array.isArray(d[k])?d[k].length:"-")' /path/to/backup/travel-content.json
psql "$PLANNER_DATABASE_URL" -c '\dt'
psql "$PLANNER_DATABASE_URL" -tA -c "select count(*) from <table>"
```

Then do a round trip and compare the counts again:

```bash
npm run planner:export -- /tmp/planner-check.json
npm run content:export -- /tmp/content-check.json
chmod 600 /tmp/planner-check.json /tmp/content-check.json
```

Finally start the app with both URLs set and `TRAVEL_CONTENT_AUTOSEED=false`, sign
in, and open a trip and a story. Delete the check files afterwards.

## Step 7 — Make it durable

Local development: keep the variables in your own shell profile or a secrets
tool, not in the repository (`.env*` stays out of version control).

On the app VM, put the connection strings in the stack's `.env` (mode `600`),
with the CA path used inside the container:

```bash
PLANNER_DATABASE_URL=postgres://cnh_app:<password>@<DB_IP>:5432/cnh?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt
CONTENT_DATABASE_URL=postgres://cnh_app:<password>@<DB_IP>:5432/cnh?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt
TRAVEL_CONTENT_AUTOSEED=false
```

```bash
docker compose -f compose.yml -f compose.app.yml -f compose.app.external-db.yml up -d app
```

The overlay [`deploy/compose.app.external-db.yml`](../deploy/compose.app.external-db.yml)
already mounts the CA at `/run/secrets/pg-ca.crt`; copy the file there **before**
`up`, or Docker creates a directory in its place.

## Backup and restore

Run on a schedule, from a host that can reach the DB:

```bash
umask 077
pg_dump --format=custom "$PLANNER_DATABASE_URL" > "cnh-$(date +%F).dump"
```

Restore into an empty database with `pg_restore --dbname=... cnh-<date>.dump`.
Test a restore at least once. The dump holds password hashes and token digests:
keep it owner-readable and off shared drives. Keep a copy off the DB VM.

## Rollback to the JSON files

1. Export first: `npm run planner:export -- planner.json` and `npm run content:export -- content.json`.
2. Unset `PLANNER_DATABASE_URL` and `CONTENT_DATABASE_URL`.
3. Point `PLANNER_STORE` and `TRAVEL_CONTENT_STORE` at the exported files and restart.

Writes made after the last export are lost, so export before switching back.
The original `.data/` folder is the older fallback.

## Checks that did not run here

- The integration tests need a **scratch** database in `TEST_DATABASE_URL`; without it
  they are skipped and must be reported as not run.
- This runbook was written against the repository, not executed against your
  servers. Report what you ran and what failed.

## Limits and open questions

- One role does both migrating and serving (ADR 0009 accepted risk).
- The rate limiter is per process, so run one app replica.
- The DB VM's firewall, certificate renewal (825 days here) and backup storage are
  owner operations; set a reminder before the server certificate expires.
