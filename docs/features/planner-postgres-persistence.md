# Feature — Planner on PostgreSQL

🇻🇳 Bản tiếng Việt: [planner-postgres-persistence.vi.md](planner-postgres-persistence.vi.md)

## Summary

The Planner — accounts, sessions, Google sign-in attempts, trips, days,
activities and expenses — can keep its data in PostgreSQL instead of one JSON
file. Travellers see no change; the owner gets data that survives a second
process, is protected by database constraints, and can be backed up with
standard tools. Decided in [ADR 0009](../adr/0009-postgres-persistence.md).
Without `PLANNER_DATABASE_URL` nothing changes: the JSON file in development, the memory
store in tests.

## Routes

None. The HTTP API in [travel-planner-core.md](travel-planner-core.md) is
unchanged. One behaviour is new: with `PLANNER_DATABASE_URL` set and the database
unreachable, every Planner route answers `503` with code `service_unavailable`
in the usual error envelope.

## Data

Seven tables in `db/migrations/0001_planner.sql`, one per Planner collection:
`planner_users`, `planner_sessions`, `planner_oauth_attempts`, `trips`,
`trip_days`, `trip_activities`, `trip_expenses`, plus `schema_migrations` and
`planner_revision` (migration `0003`: one row, a counter every committing
transaction increments, used by the cache below). Each
column maps to one field of the zod schemas in `src/server/planner/schemas.ts`
(`order` is `sort_order`); a hidden `seq` column keeps insertion order so a table
reads back in the order the JSON array had.

- Unique: handle, token hash, email, Google subject, session token hash, OAuth
  state hash, share token, `(trip_id, day_number)`, `(day_id, sort_order)` (both
  deferred, so a reorder can commit).
- Foreign keys: sessions and OAuth attempts cascade from users; days,
  activities and expenses cascade from trips; activities cascade from days. A
  trip's `owner_id` is not cascading — the repository deletes the user's trips
  first (ADR 0017), so the database never sees an orphan.
- Expenses copy the repository exactly: deleting an activity keeps the expense
  and its day (`activity_id ON DELETE SET NULL`); a day that still holds an
  expense cannot be deleted (`day_id` NO ACTION), mirroring `dropDays`. Both are
  pinned by tests.
- `BIGINT` amounts reach the repository as numbers through
  `normalizeVnd`; timestamps are `timestamptz` read back as ISO strings (so
  `…:00Z` reads back as `…:00.000Z`); `source_template` is `JSONB`. A NULL in a
  field the schema marks `.optional()` reads back as *absent*, so a record equals
  what the JSON store returns — except that an explicit `null` there and an
  absent field are one and the same in the database.

## How it works

`DocumentStore` gained `transact(mutate)`: one atomic read-modify-write.
`PlannerRepository.transaction` now calls it (it still applies
`withTripDefaults`); no other repository method changed. The memory and JSON
stores implement it on their existing queue; a throw writes nothing.

The Postgres store (`src/server/persistence/postgres-planner-store.ts`) runs
`transact` as one database transaction: `BEGIN`, a global
`pg_advisory_xact_lock`, load all seven tables, run the mutation on a clone,
diff the clone against the loaded rows by `id`, write only the changed rows
(INSERT parents first, UPDATE, then DELETE children first), `COMMIT`. Any throw —
a repository error, a constraint, the network — is a `ROLLBACK`. `read()` is a
`REPEATABLE READ READ ONLY` transaction. Every row read is
parsed with the same zod schema the JSON store's types come from. The diff and
the row mapping are pure (`planner-rows.ts`) and unit tested offline; every
statement is parameterised, and identifiers come only from a constant table list.

**Cache validated by revision.** Each store instance keeps the last state it
loaded, tagged with the `planner_revision` it was loaded at. `read()` asks for
the current revision in the same snapshot; equal means a `structuredClone` of the
cache with no table load, different means a reload of the seven tables. `transact`
makes the same check after taking the lock, so a write on an unchanged store
needs no reload either. A transaction that changes anything increments the
revision before `COMMIT` and then drops the cache (a no-op transaction changes
nothing and leaves the revision alone); a `ROLLBACK` leaves cache and revision
untouched. Callers only ever receive clones. Another replica's commit moves the
revision, so a replica is at worst one request behind — never silently wrong.
The store also exposes `revision()`; the repository compares it to rebuild its
share-token index, so a link created or revoked on one replica is honoured on the
other. The JSON and memory stores have no `revision()` and keep the old
behaviour.

Failures are translated and sanitised: unique violation (`23505`) becomes the
existing `409`; connection, authentication, resource and timeout failures become
`503`; anything else becomes a generic error carrying only the SQLSTATE. The
driver message — which can hold a host, a role or row content — is never
returned or logged, and the connection string never appears.

Store selection is in `src/server/planner/instance.ts`: `PLANNER_DATABASE_URL` set means
PostgreSQL and **never** a fallback to the file. When the instance is first built,
before any request is served, it runs the pending migrations (`migrateOnStartup`)
on one connection under a session advisory lock held across the `schema_migrations`
bootstrap and every file, so replicas starting together apply each file once. If
that fails the route answers `503 service_unavailable` with no driver detail (the
log carries only an error code), the half-built pool is closed, and the next
request tries again.

`npm run db:migrate` runs the same code by hand: numbered files, each in its own
transaction with its checksum recorded. `npm run planner:import -- <file>` validates with the zod
schemas, runs `validateIntegrity()` against the real content catalog, drops
expired sessions, refuses non-empty tables, and inserts in one transaction.
`npm run planner:export -- <file>` writes a `planner.json` (mode 0600) the JSON
store can open — the rollback path. Operation is in
[usage](../usage.md#run-the-planner-on-postgresql).

## Files

| Path | Role |
|---|---|
| `src/server/persistence/json-store.ts` | `DocumentStore.transact` for the memory and JSON stores |
| `src/server/persistence/planner-rows.ts` | Table layout, row mapping, the diff (pure) |
| `src/server/persistence/postgres-planner-store.ts` | Advisory-lock transaction, loading, error translation |
| `src/server/persistence/postgres-pool.ts` | One small `pg` pool; DATE kept as text |
| `src/server/persistence/migrate.ts` | Migration runner, session lock, `migrateOnStartup` |
| `src/server/persistence/planner-transfer.ts` | Import and export logic |
| `src/server/planner/instance.ts` | Store selection by `PLANNER_DATABASE_URL` |
| `src/server/planner/repository.ts` | `transaction` delegates to `store.transact` |
| `src/server/content/errors.ts` | New code `service_unavailable` (503) |
| `db/migrations/0001_planner.sql`, `db/migrations/0002_planner_user_role.sql`, `db/migrations/0003_planner_revision.sql`, `db/rollback/*.sql` | Schema (0002 adds the ADR 0006 `role` column, 0003 the revision counter) and the manual rollbacks |
| `.github/workflows/ci.yml` | A `postgres:17` service and `TEST_DATABASE_URL`, so the integration suite runs in CI |
| `scripts/db-migrate.ts`, `scripts/planner-import.ts`, `scripts/planner-export.ts` | Thin entry points, run by `vite-node` |

## Tests

- `tests/document-store-transact.test.ts` — memory and JSON: a throw writes
  nothing (sync and async), overlapping transactions serialise with no lost
  update, the callback gets a private copy.
- `tests/planner-rows.test.ts` — offline: a no-op mutation yields zero
  statements; insert, update (changed columns only) and delete per collection;
  FK-safe ordering; a reorder is `sort_order` updates only; values are bound, not
  interpolated; every collection round-trips equal to the JSON store's records,
  including null versus absent, an explicit `false`, BIGINT strings and
  timestamps; corrupt rows are reported without content.
- `tests/postgres-planner-store.test.ts` — against a fake driver: the BEGIN /
  lock / revision / load / COMMIT protocol, ROLLBACK on a throw, REPEATABLE READ for reads, the revision cache (hit, reload after a foreign commit, clones only, no reload for a write, bump on commit, none on a no-op, untouched by a rollback),
  `23505` to 409, outage codes to 503 without the driver message, and an HTTP
  check that `PLANNER_DATABASE_URL` pointing at a closed port gives 503 with no secret.
- `tests/planner-transfer.test.ts` — import refuses non-empty stores, invalid
  files and dangling references; export then import is identical.
- `tests/migrate.test.ts` — runner: new, already applied, edited, failing; the
  lock wraps the bootstrap and every file and is always released (a connection
  whose unlock fails is destroyed); the startup wrapper gives 503 with no detail.
- `tests/planner-share-index-revision.test.ts` — offline: a share link created or
  revoked through one repository is honoured by another over the same store, and
  the index is reused while the revision is unchanged.
- `tests/planner-postgres.integration.test.ts` — **only with
  `TEST_DATABASE_URL`**, otherwise skipped (report as not run): migrate, the
  scenario ending identical to the memory store, a full plan/edit/purge flow,
  the foreign-key actions above, a deferred-unique reorder, two connection
  pools never losing an update, another store's write invalidating the cache, a
  warm-cache store unable to overwrite a newer state (412), a rollback leaving the
  revision alone, a warm read equal to a cold read, two concurrent startup
  migrations applying each file once, a share link resolving through a second
  store and stopping when revoked, 409 on a duplicate across processes, rollback,
  and import/export through a real database.

## Limits and open questions

- A cache hit costs one revision query, but a changed revision (any write, on
  any replica) reloads every Planner row, and one global lock serialises writes. Fine for a few thousand trips; the trigger to move hot reads
  (`identify`, `listTrips`, `getTrip`) onto targeted queries is a p95 above about
  200 ms (ADR 0009).
- The rate limiter stays per process (the share-token index no longer does, see above).
- The Travel Content store is still a JSON file.
- The integration tests were run locally against PostgreSQL 14 and run in CI
  against `postgres:17`; the owner's VM runs 16 or 17. Nothing used is newer than 12, but they should be run once against the
  real major version with a scratch database.
- `import` and `export` run through `vite-node`, a transitive dependency of
  Vitest, so they need dev dependencies installed. If that is unwelcome in the
  runtime image, run them from a checkout or the build stage.
- The least-privilege role is documented, not created: that is the owner's step.
  A `/sec-check` of the adapter, the grants and secret handling is recommended
  before going live.
- Timestamps normalise to millisecond ISO form on first write. Zod trims string
  fields on read, as it does on write.
