# Task Contract: PG-01 Planner persistence on PostgreSQL
- Class: XL (persistence of real accounts; new runtime dependency; data migration)
- Desired outcome / user impact: the Planner keeps its data in PostgreSQL on the
  owner's VM (16/17, private Docker network, no TLS) when `PLANNER_DATABASE_URL` is set,
  safely across processes, with DB-enforced integrity. Without `PLANNER_DATABASE_URL`
  nothing changes: JSON file in dev, memory store in tests. No API or UI change.
- Scope IN: `transact` on `DocumentStore`; Postgres Planner store; migration
  0001; migrate / import / export scripts; store selection in `instance.ts`;
  503 when the DB is down; unique-violation → existing 409 semantics; tests;
  feature doc + architecture/usage docs.
- Scope OUT: Travel Content System store; rate limiter; rewriting repository
  methods as targeted SQL (ADR 0009 option C); Docker/compose files; creating
  the DB role on the VM (owner action, documented in usage).
- Evidence: `src/server/persistence/json-store.ts` (DocumentStore, memory + JSON
  stores, queue, cache); `src/server/planner/store.ts` (PlannerData, 7
  collections, normalize); `src/server/planner/instance.ts` (PLANNER_STORE);
  `src/server/planner/repository.ts:200` (transaction = read → mutate → write
  behind an in-process queue; `withTripDefaults`; shareIndex cache dropped per
  write); `src/server/planner/schemas.ts` (field names, nullable/optional);
  `src/server/planner/money.ts` (VND boundary).
- Constraints / dependencies: new deps `pg` (runtime) and `@types/pg` (dev) only.
  No ORM, no query builder, no `pg-mem`. Every query parameterised. Migrations
  never run on app boot. Never fall back to JSON when `PLANNER_DATABASE_URL` is set.
- Architecture decision: `docs/adr/0009-postgres-persistence.md` (Accepted
  2026-11-11) — binding; deviations go back to the architect.
- Interface contract:
  - `DocumentStore<T>` gains `transact<R>(mutate: (data: T) => Promise<R> | R): Promise<R>`.
    Memory + JSON stores implement it on their existing queue (read → mutate →
    write; a throw writes nothing). Existing `read`/`write` stay.
  - `PlannerRepository.transaction` calls `store.transact`, applying
    `withTripDefaults` inside the callback; shareIndex invalidation unchanged.
    No other repository method changes. Its in-process queue may remain as an
    extra local serialisation.
  - Postgres store (`src/server/persistence/postgres-planner-store.ts` or
    similar under `src/server/**`): `BEGIN` → `pg_advisory_xact_lock(const key)`
    → load 7 tables → `mutate(clone)` → per-collection diff by `id` → minimal
    INSERT/UPDATE/DELETE in FK-safe order (deletes children-first, inserts
    parents-first) → `COMMIT`; any throw → `ROLLBACK`. `read()` in
    `REPEATABLE READ READ ONLY`. No cross-request cache.
  - Row ↔ record mapping: timestamps `timestamptz` ↔ `toISOString()` strings;
    `BIGINT` ↔ number via the money boundary; optional fields absent in JSON stay
    absent (not `null`) on read-back when the DB value is NULL *only* where the
    schema marks them `.optional()` — the round-trip must equal what the JSON
    store returns.
  - Tables and constraints per ADR 0009 §3. Expense FK delete actions must match
    current repository behaviour (find it, pin it with a test).
  - Selection: `PLANNER_DATABASE_URL` set → Postgres; else JSON at `PLANNER_STORE`.
    Connection failure → Planner routes answer 503 with the existing error
    envelope. Postgres unique violation (23505) surfaces as the repository's 409
    conflict error, never a 500.
  - Scripts: `npm run db:migrate` (runner + `schema_migrations`, each file in
    its own transaction), `npm run planner:import -- <file>` (zod-validate,
    `validateIntegrity()`, refuse non-empty tables, one transaction),
    `npm run planner:export -- <file>`. No new dependency to run TS scripts —
    check what is already installed (e.g. `vite-node` via vitest) or keep
    scripts in `.mjs`; the logic they call lives in `src/server/**` and is unit
    tested.
- Tasks by owner: Architect — ADR 0009 (done), this contract, `docs/architecture.*`.
  BE — everything under Interface contract, tests, `docs/usage.*`, feature doc.
  FE — none. QC / Security — NOT RUN unless the user calls them; `/sec-check`
  recommended. Git — main session, only on user approval.
- File ownership: BE owns `src/server/**`, `db/**`, `scripts/**` (new files),
  `package.json`, `package-lock.json`, `tests/**` (new/changed planner store
  tests), `docs/usage.*`, `docs/features/planner-postgres-persistence.*`,
  `docs/features/README.*`. Main session/architect owns `docs/adr/**`,
  `docs/architecture.*`, this contract.
- Acceptance criteria / tests:
  1. All existing tests pass unchanged in behaviour (472 at contract time).
  2. `transact` on memory + JSON stores: a throw writes nothing; serialised.
  3. Pure diff unit tests (offline): no-op mutate ⇒ zero statements; insert /
     update / delete per collection; FK-safe ordering; reorder of activities.
  4. Row mapping round-trip tests (offline): every collection, incl. optional
     fields, null vs absent, BIGINT strings, timestamps.
  5. Postgres integration tests gated on `TEST_DATABASE_URL` (skipped without
     it, and reported NOT RUN): migrate, import, the Planner acceptance flow,
     two concurrent `transact` calls serialise, unique violation → 409.
  6. Import refuses non-empty tables and invalid files; export ⇒ import
     round-trips to an identical document.
  7. `npm run typecheck`, `lint`, `test` PASS with output stated.
- Security and migration risks: secrets only via env, never logged (no
  connection string in error messages); least-privilege role documented;
  string-built SQL is a defect; import runs integrity check before writing;
  the diff could drop rows — covered by tests 3–4.
- Rollback approach: unset `PLANNER_DATABASE_URL` after `planner:export` to a JSON
  file pointed at by `PLANNER_STORE`; code revert is the PR revert.
- Budget: one `backend-engineer` invocation (one follow-up allowed for fixes);
  stop if the contract needs a repository rewrite beyond `transaction`, or a new
  dependency beyond `pg` / `@types/pg` — report back instead.
- Amended 2026-11-11 (reconciled with ADR 0008): `PLANNER_DATABASE_URL`; migrations at startup under a session advisory lock (supersedes "never on app boot" below); revision-validated cache (migration 0003); share index follows the store revision; CI runs the integration suite on `postgres:17`.
- State: REVIEW (implemented 2026-11-11; checks pass; integration run on PG 14 only; qc/security NOT RUN)
- Feature document owner: backend-engineer —
  `docs/features/planner-postgres-persistence.md` + `.vi.md`, registered in
  `docs/features/README.*`.
- Architecture/usage doc updates needed: `docs/architecture.*` (architect: stale
  "Persistence: None" row, store selection, lock); `docs/usage.*` (BE: env vars,
  migrate/import/export, backup, deploy dependency, owner DB-role setup).
