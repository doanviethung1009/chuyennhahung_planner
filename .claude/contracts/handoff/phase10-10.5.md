# Handoff — batch 10.5 Reports + admin queue
Branch `feat/community-reports` (nothing committed/pushed). Contract: `phase10-10-5-reports-queue.md`.

## Done
- **Migration `0013_reports.sql`** + rollback; next free = `0014`. Table `reports`, key `reports`, index `(status, created_at)`, no FKs. `clientKey` = hashed guest key (null for members); share token never stored.
- Repository: `createReport(input, {userId, clientKey})`, `listReports(status?)`, `resolveReport(id, {outcome, reason}, actor)`. Resolve = one `report_dismissed|report_actioned` event on the reported trip/review (via `record`), idempotent, other outcome → 409. No `targetKind` widening needed.
- Routes: `POST /api/community/reports` (guest or member, no Terms gate, limiter `report` 10/day, honeypot `website`, fail closed, member recognised only if same-origin), `GET /api/admin/community/reports`, `POST …/[id]/resolve` (`community:moderate`). Unknown/non-public/removed target → one 404.
- UI: `components/reports/report-button.tsx` (native modal `<dialog>`), on community trip card and each review; `components/admin/community/report-queue.tsx` as a section on `/admin/community` (not a tab). Strings `communityReports`, `adminReports` VI/EN.
- Docs: `features/community-reports.{md,vi.md}`, README rows, architecture, specs-community-database, runbook, project-context.

## Shared/other-batch changes to know
- **Limiter retention 2 h → 48 h** (`COUNTER_RETENTION_MS`, `postgres-rate-limiter.ts`) so a 24 h window fits (max window = half). One 10.3 assertion edited: `tests/postgres-rate-limiter.test.ts` retention bound now 48 h. `WRITE_LIMITS.report` + `getWriteLimiters().report` added.
- Public projection: `PublicCommunityReview.id` added (random `rev_…`). Test changed: only `community-reviews.test.ts` "keeps the public projection" (key list gains `id`). `ReviewList` now keys by id.
- Other tests touched: `planner-rows.test.ts` (delete order gains `reports`), `planner-pg-fixtures.ts` (scenario files one report), `planner-postgres.integration.test.ts` (TRUNCATE + reports block). No `button.tsx` change.

## For 10.6
- Reuse `report` limiter pattern; key is `u:<userId>` / `c:<clientKey>`; `clientKey` hashing is `guestKeyOf` (repository.ts) — the single helper to swap for HMAC. `x-forwarded-for` still forgeable.

## Not done
- UI at 375/768/1280: NOT RUN. qc / security: NOT RUN (recommend `/sec-check`: anonymous write, notes).

## Checks
typecheck PASS · lint PASS · test PASS: with TEST_DATABASE_URL (local PostgreSQL 14, throwaway cluster) 81 files, 1061 tests; without it 78 files + 3 skipped, 999 passed, 62 skipped.
