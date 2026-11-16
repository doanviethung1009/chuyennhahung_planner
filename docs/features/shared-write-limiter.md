# Feature — Shared write limiter

🇻🇳 Bản tiếng Việt: [shared-write-limiter.vi.md](shared-write-limiter.vi.md)

## Summary

The two review write limits — 5 per hour per signed-in traveller and 3 per hour per guest client (ADR [0014](../adr/0014-community-trips-and-reviews.md)) — used to live in process memory: a restart reset them and two app instances doubled them. When the Planner runs on PostgreSQL they now count in a shared table, so a restart keeps the count and every instance sees the same one. If the database cannot be reached the write is refused with `503`, never allowed (ADR [0019](../adr/0019-community-foundation.md) §3). Visitors see no change; without PostgreSQL the in-process limiters are unchanged.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `PUT /api/planner/reviews/[placeSlug]` | same | same |
| `POST /api/community/reviews` | same | same |

Responses are unchanged: `429 rate_limited` with an integer `Retry-After` when over the limit; **new** `503 service_unavailable` (no `Retry-After`) only when the limiter's database fails — and then the review is not written.

## Data

Table `rate_limit_counters` (migration `0011_rate_limit_counters.sql`, manual rollback `db/rollback/0011_rate_limit_counters.sql`): `key` text (SHA-256 hex of limiter name + caller key, so no address or user id in the clear), `window_start` bigint (epoch ms), `count` integer; primary key `(key, window_start)`; no foreign keys (ADR 0013). Not part of the JSON export/import: counters are disposable. Only counters, never review content.

## How it works

`AsyncRateLimiter { check(key): Promise<RateLimitResult> }` (`src/server/rate-limit.ts`) sits beside the sync `RateLimiter`, which stays for reads, the JSON store and every other limiter. `createPostgresRateLimiter` (`src/server/persistence/postgres-rate-limiter.ts`) runs one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING count` per check on the limiter's **own small pool** (2 connections, `statement_timeout` 3 s — so anonymous guest traffic cannot hold the Planner store's connections, and a slow database becomes a fast `503`), outside the store's transaction and advisory lock, so a check never waits for a long write and a refused write still counts. Fixed window: `window_start = floor(now / window) × window`; count above the limit → blocked, `Retry-After` = seconds to the window end. The count is capped at `limit + 1` so a flood cannot overflow it. About every 10 minutes one check deletes windows older than 2 hours (so rows from rotated forged keys live at most that long), in the background, in batches of 1000 (at most 10 per sweep), ignoring failure. A limiter's window may be at most 1 hour.

`src/server/planner/instance.ts` builds the limiters with the repository: PostgreSQL counters on the same pool when `PLANNER_DATABASE_URL` is set, otherwise the in-process limiter wrapped by `asAsyncLimiter`. A configured database never falls back to in-process counters. Routes call `(await getWriteLimiters()).plannerReview.check(userId)` / `.guestReview.check(clientKey)` **before** any write; a thrown `service_unavailable` leaves the store untouched.

**Adding a write limiter (10.4, 10.5):** add an entry to `WRITE_LIMITS` in `rate-limit.ts` (`name`, `limit`, `windowMs` ≤ 1 h; raise `COUNTER_RETENTION_MS` first for a longer one), add it to `buildLimiters` in `instance.ts`, call `check` before the write.

## Files

| Path | Role |
|---|---|
| `src/server/rate-limit.ts` | `AsyncRateLimiter`, `asAsyncLimiter`, `WRITE_LIMITS` |
| `src/server/persistence/postgres-rate-limiter.ts` | the shared limiter |
| `src/server/planner/instance.ts` | selection, `getWriteLimiters` |
| `src/app/api/planner/reviews/[placeSlug]/route.ts`, `src/app/api/community/reviews/route.ts` | callers |
| `db/migrations/0011_rate_limit_counters.sql`, `db/rollback/0011_rate_limit_counters.sql` | table and rollback |

## Tests

`tests/review-limiter-routes.test.ts` (HTTP 429 + `Retry-After` for both routes, per user and per client; written green on the old in-memory code first, P10-13); the default 30-day guest restriction is asserted in `tests/community-reviews.test.ts`. `tests/postgres-rate-limiter.test.ts` (fake pool: hashed key, fail closed without driver detail, `Retry-After`, sweep cadence). `tests/review-limiter-fail-closed.test.ts` (both routes: `503` and nothing written). `tests/postgres-rate-limiter.integration.test.ts` (real PostgreSQL, injected clock: two instances share a count, concurrent checks exact, restart keeps the count and the next window resets, names apart, sweep, dead pool fails closed) — skipped without `TEST_DATABASE_URL`; CI runs it. `tests/rate-limit.test.ts` is unchanged.

## Limits and open questions

- **`x-forwarded-for` can still be forged.** The guest key is the client's first forwarded hop; rotating it bypasses the 3/hour limit. Not fixed here (batch 10.6: HMAC key and proxy header trust). The repository's 20-a-day cap per place remains the backstop.
- A fixed window allows up to twice the limit across a window boundary; the old in-memory limiter was a sliding window.
- One database round trip per limited write; its cost is **not measured** (assumption: the database is on the LAN).
- The database is now a dependency of these two writes: while it is down they answer `503`, as the rest of the Planner already does.
- Only these two limiters moved; sign-in, signup, Google and share-read stay in process.
- Rollback: revert the routes and `instance.ts`, run the rollback SQL by hand. A `/sec-check` before merge is recommended and has not been run.
