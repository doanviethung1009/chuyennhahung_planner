# Feature — Travel Content on PostgreSQL tables

🇻🇳 Bản tiếng Việt: [content-postgres-tables.vi.md](content-postgres-tables.vi.md)

## Summary

Travel Content — places, stories, collections, reviews and templates — can keep its
data in PostgreSQL, one table per collection, instead of one JSON file. Readers and
editors see no change; the owner gets content that several app instances share with no
lost update, that the database protects with keys and constraints, and that can be
backed up with standard tools. Decided in
[ADR 0013](../adr/0013-content-on-postgres-tables.md), the counterpart of
[planner-postgres-persistence.md](planner-postgres-persistence.md). Without
`CONTENT_DATABASE_URL` nothing changes: the JSON file in development, the memory store
in tests.

## Routes

None. The HTTP API in [../travel-content-api.md](../travel-content-api.md) and the
public pages are unchanged. One behaviour is new: with `CONTENT_DATABASE_URL` set and
the database unreachable, the admin content routes and every public page that reads
content answer `503` with code `service_unavailable` in the usual error envelope; the
app never falls back to the file.

## Data

Migration `db/migrations/0004_content.sql` creates `content_places`,
`content_stories`, `content_collections`, `content_reviews`, `content_templates` and
`content_revision` (one row, a counter every committing transaction increments).

- **Key:** `slug` (reviews: `id`) is the primary key, so uniqueness is enforced by the
  database as well as by the repository. A hidden `seq` column keeps insertion order.
- **Columns for scalars:** status, dates (`date`), timestamps (`timestamptz`), rating
  and coordinates (`double precision`), VND amounts (`bigint`), counts, destination,
  category, travel style. Enums have `CHECK` constraints, and the story's travel dates,
  the place's coordinates and the review's subject are split into two columns each.
- **`jsonb` for structure:** localised `{vi, en}` text, story blocks, gallery, SEO,
  affiliate links, actual cost, template days and the source snapshot — they are read
  and written as a unit and nothing queries inside them today.
- **`text[]` for slug lists:** `place_slugs`, `review_ids`, `itinerary_slugs`,
  `destination_slugs`, `story_slugs`.
- **No foreign keys between content entities.** The repository has no "still
  referenced" rule and a template deliberately outlives its story (ADR 0001 §4), so a
  database FK would change behaviour in the same change that moves the storage. The
  integrity check (`validateIntegrity`) and the import validation stay the guard.
- **Reading back.** A NULL in a nullable field reads as `null`; `bigint` reaches the
  repository as a number; timestamps read back as ISO strings with milliseconds.

## How it works

`ContentStore` is still `DocumentStore<ContentData>`; `ContentRepository` and the 26
handlers did not change. The Postgres store is the table engine that ADR 0009 built for
the Planner, now parameterised: `createPostgresTableStore(pool, { tables, lockKey,
revisionTable, label })` in `postgres-planner-store.ts`. `transact` is one database
transaction: `BEGIN`, an advisory lock (`CONTENT_LOCK_KEY`), load the five tables or reuse
the cache, run the mutation on a clone, write only the rows that differ (keyed by
`slug`), bump `content_revision`, `COMMIT`. A throw is a `ROLLBACK`. `read()` is a
`REPEATABLE READ READ ONLY` transaction. The per-instance cache is validated by
`content_revision`: another instance's commit moves it, so a replica is at worst one
request behind, never silently wrong.

`src/server/persistence/content-rows.ts` is the whole mapping: which column holds which
schema field, parsed on the way out with the same zod schemas the repository uses. The
diff, the SQL generation and the error translation (unique violation to `409`,
connection failures to `503` with no driver detail) are shared with the Planner.

`src/server/content/instance.ts` selects the store. `CONTENT_DATABASE_URL` set means
PostgreSQL: the instance runs the pending migrations before serving a request, then
seeds the demo content while holding a session advisory lock (unless
`TRAVEL_CONTENT_AUTOSEED=false`) so replicas starting together seed once. A failure at
either step is a `503` and the next request retries.

`npm run content:import -- <file>` validates a `travel-content.json` with the repository
schemas, runs the integrity check, refuses non-empty tables and inserts in one
transaction. `npm run content:export -- <file>` writes a file the JSON store can open
(mode `0600`) — the rollback path. `npm run db:migrate` migrates every database that
has a URL, and `npm run content:seed-static` tops up whichever store is selected.
Operation is in [usage](../usage.md#run-travel-content-on-postgresql).

## Files

| Path | Role |
|---|---|
| `db/migrations/0004_content.sql`, `db/rollback/0004_content.sql` | Schema and the manual rollback |
| `src/server/persistence/content-rows.ts` | Table list and column mapping for the five collections |
| `src/server/persistence/planner-rows.ts` | The shared row mapping and diff (now parameterised by table list and key) |
| `src/server/persistence/postgres-planner-store.ts` | The shared transaction/cache protocol (`createPostgresTableStore`), `CONTENT_LOCK_KEY` |
| `src/server/persistence/postgres-content-store.ts` | The content store: engine plus content parameters |
| `src/server/persistence/content-transfer.ts` | Import and export logic |
| `src/server/persistence/migrate.ts` | `migrateOnStartup` takes a label for its log and 503 text |
| `src/server/content/instance.ts` | Store selection by `CONTENT_DATABASE_URL`, seeding under a lock |
| `scripts/content-import.ts`, `scripts/content-export.ts`, `scripts/db-migrate.ts`, `scripts/content-seed-static.ts` | Entry points, run by `vite-node` |
| `deploy/compose.app.yml` | The comment on when the app may be scaled |

## Tests

- `tests/content-rows.test.ts` — offline: every schema field has a column; every seeded
  record round-trips equal to what the JSON store holds; a no-op yields zero
  statements; updates carry only the changed columns and are keyed by `slug` (reviews
  by `id`); slug lists bind as `text[]` and values are never interpolated; a corrupt row
  is reported by table and key without content.
- `tests/content-transfer.test.ts` — offline: import into an empty store, refusal of a
  non-empty one (nothing written), an invalid file reported by path without echoing its
  content, a dangling reference refused, export then import identical.
- `tests/content-database-selection.test.ts` — a closed port gives `503` with no secret
  and no host (and no fallback to the file); the store takes its own lock key, reads its
  own revision table and loads its five tables in order; a no-op does not bump the
  revision.
- `tests/planner-rows.test.ts`, `tests/postgres-planner-store.test.ts`,
  `tests/migrate.test.ts`, `tests/planner-transfer.test.ts` — unchanged, and the proof
  that sharing the engine did not change the Planner.
- `tests/content-postgres.integration.test.ts` — **only with `TEST_DATABASE_URL`**,
  otherwise skipped (report as not run): migration `0004` applied, the seed ending
  identical to the memory store, an edit/publish/unpublish/delete flow ending identical,
  slug lists, dates, enums and nullable fields intact in the tables, the primary key and
  `CHECK` constraints enforced by the database (`23505`, `23514`), two connection pools
  writing at once with no lost update, another instance's write seen on the next read,
  and a throwing mutation leaving the data and the revision alone.

## Limits and open questions

- A changed revision (any write, on any replica) reloads all five tables, and one global
  lock serialises content writes. Fine for hundreds of stories; the trigger to move hot
  reads (`getPublicContent`, the list endpoints) onto targeted queries is a p95 read
  above about 200 ms or a content size above about 5 MB (ADR 0013).
- No foreign keys and no "still referenced" rule: deleting a place a story lists is
  allowed, as before. This is a separate decision.
- The mapping must follow the schemas. `tests/content-rows.test.ts` fails when a schema
  field has no column, but a new column still needs a migration written by hand.
- Both stores' tables can exist in one database (each store runs the whole migration
  set). Harmless, and the price of one runner.
- The integration tests ran locally against PostgreSQL 14 and also run in CI against
  `postgres:17`; the owner's VM runs 16 or 17. They should be run once against the real
  major version with a scratch database.
- The first request after a deploy waits for migrations and, on a fresh database, the
  seed. The unrelated per-process rate limiter still limits scaling the app.
- A `/sec-check` of the new connection string, the migration and the import/export
  files is recommended before the first production deploy; it has not been run.
