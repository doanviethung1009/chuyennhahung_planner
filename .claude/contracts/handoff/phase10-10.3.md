# Handoff — batch 10.3 Shared write limiter
Branch `feat/shared-write-limiter` (nothing committed/pushed). Contract: `phase10-10-3-shared-limiter.md`.

## Done
- Step 0 (P10-13): `tests/review-limiter-routes.test.ts` (429 + `Retry-After`, Planner 5/h and guest 3/h) green on the old in-memory code before the change. The 30-day guest restriction default was already asserted (`tests/community-reviews.test.ts`, "time-boxes a guest").
- **Migration `0011_rate_limit_counters.sql`** + rollback. Next free number = `0012` (specs-community-database renumbered 0012+ by one).
- Interface `AsyncRateLimiter { check(key): Promise<RateLimitResult> }` and `asAsyncLimiter(syncLimiter)` in `src/server/rate-limit.ts`; sync `RateLimiter` untouched.
- `src/server/persistence/postgres-rate-limiter.ts`: `createPostgresRateLimiter({ pool, name, limit, windowMs, now? })`; sha256 key, fixed window, one upsert outside the store transaction, sweep >24h, any DB error → `ContentError('service_unavailable')` (fail closed).
- `planner/instance.ts`: `getWriteLimiters()` (built beside the repository, same cached promise; pool exposed from `selectStore`).
- `plannerReviewLimiter` / `guestReviewLimiter` exports removed; routes use `getWriteLimiters()`.

## Add a write limiter (10.4 report, 10.5 terms)
1. Add `{ name, limit, windowMs ≤ 24h }` to `WRITE_LIMITS` (`rate-limit.ts`). 2. Add it to `buildLimiters` in `instance.ts`. 3. In the route: `const l = await (await getWriteLimiters()).<name>.check(key); if (!l.ok) throw rateLimited(l.retryAfterSeconds)` **before** the write. Use `userId`, never raw IP, where a user exists.

## Not done / notes
- `x-forwarded-for` spoofing NOT fixed (10.6); DB round trip per check unmeasured; fixed window allows 2× limit at a boundary.
- Docs: `docs/features/shared-write-limiter.{md,vi.md}`, README rows, architecture, usage, specs-community-database, project-context. No route added → runbook untouched. No new ADR.

## Checks
typecheck PASS · lint PASS · test PASS: with TEST_DATABASE_URL (local PostgreSQL, throwaway cluster) 71 files, 965 tests; without it 68 files + 3 skipped, 917 passed, 48 skipped. CI also runs the Postgres cases. qc / security: NOT RUN (recommend `/sec-check`).
