# Task Contract: content-postgres — Travel Content on normalised PostgreSQL tables
- Class: XL (persistence of the whole editorial dataset, new secret, migration, deploy)
- Desired outcome / user impact: Travel Content survives more than one app instance and has
  real backups, with zero change for readers and editors. Admin edits on one replica are
  seen by every replica. The owner chose option B (normalised tables) over one JSONB
  document, for a long-lived application.
- Scope IN: migration `0004_content.sql` (+ rollback); a generic table engine shared with
  the Planner; the content row mapping; `CONTENT_DATABASE_URL` store selection with
  startup migration and seeding under a lock; `content:import` / `content:export`;
  `db:migrate` for both URLs; tests; ADR 0013; feature document; architecture + usage
  edits; deploy compose env.
- Scope OUT: any change to `ContentRepository` behaviour or to the 26 API handlers; foreign
  keys between content entities (the repository has no "in use" rule yet — adding FKs
  would change behaviour, see ADR 0013); targeted SQL reads (the ADR names the trigger);
  rate limiter; Planner behaviour.
- Evidence: `src/server/content/instance.ts` (JSON only); `src/server/content/store.ts`
  (`ContentData` = places, stories, collections, reviews, templates); `src/server/persistence/
  planner-rows.ts`, `postgres-planner-store.ts` (the pattern); `deploy/compose.app.yml:32`
  ("Never --scale app=2 until both move to Postgres"); ADR 0008 §Decision 1, ADR 0012 §
  Consequences ("prerequisite to run two instances").
- Constraints / dependencies: no new runtime dependency (`pg` already present); Planner
  tests must stay green unchanged; no fallback to JSON once `CONTENT_DATABASE_URL` is set.
- Architecture decision / ADR: `docs/adr/0013-content-on-postgres-tables.md` (+ `.vi.md`).
- Interface contract: `ContentStore = DocumentStore<ContentData>` unchanged. New env
  `CONTENT_DATABASE_URL`. Tables `content_places|stories|collections|reviews|templates`,
  `content_revision`. Key column is `slug` (reviews: `id`).
- Tasks by owner: Architect — this contract, ADR, architecture edit. BE — engine,
  rows, store, instance, scripts, migration, tests. FE — none. QC/Security — NOT RUN
  unless asked; **recommend `/sec-check`** (new secret, migration). Git — main session.
- File ownership: one agent (main session). No subagents.
- Acceptance criteria / tests: every content collection round-trips equal through
  row mapping (seed data included); a no-op yields zero statements; fake-driver protocol
  test; integration test (needs `TEST_DATABASE_URL`) proving the full repository scenario
  matches the memory store, two pools never lose an update, cache invalidated by another
  writer, concurrent startup seeds once; Planner suites unchanged; typecheck, lint, test.
- Security and migration risks: a new connection string (server-only, never logged — same
  rules as `PLANNER_DATABASE_URL`); migration 0004 is additive; the two stores may share a
  database, so each store runs the whole migration set on its DB (ADR 0013 §Decision 4);
  seeding demo content into a production DB — mitigated by `TRAVEL_CONTENT_AUTOSEED=false`.
- Rollback approach: `npm run content:export` writes a `travel-content.json`; unset
  `CONTENT_DATABASE_URL`; `db/rollback/0004_content.sql` drops the tables.
- Budget: 0 subagents. Stop condition: any Planner test fails, or the integration test
  shows a row-mapping loss that needs a repository change — stop and report.
- State: IN_PROGRESS
- Feature document owner: backend role (main session) — `docs/features/content-postgres-tables.md` + `.vi.md`
- Architecture/usage doc updates needed: `docs/architecture.*` (persistence table, phases),
  `docs/usage.*` (env var, migrate, import/export, deploy, troubleshooting)
