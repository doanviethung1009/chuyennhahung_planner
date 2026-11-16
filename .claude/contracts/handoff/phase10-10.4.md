# Handoff — batch 10.4 Creator Terms acceptance
Branch `feat/terms-acceptance` (nothing committed/pushed). Contract: `phase10-10-4-terms-acceptance.md`.

## Done
- `termsVersion = '2026-11-16'` in `src/content/site.ts`; `tests/terms-version.test.ts` pins SHA-256 of the VI+EN text to it (fails on text change without bump, prints the new hash).
- **Migration `0012_terms_acceptances.sql`** + rollback; next free = `0013`. Table has `seq` (store reads ORDER BY seq), `id` PK, `UNIQUE (user_id, version)` (engine keys by `id`, so not a composite PK). JSON key `termsAcceptances` in store/rows/transfer. No `targetKind` widening needed (`user`).
- Repository: `termsStatus(userId)`, `acceptTerms(userId, version, lang)` (idempotent, event `terms_accepted` only on first), **`requireTermsAccepted(userId)`** = the gate (403 `forbidden`, reason `terms_not_accepted`). Option `termsVersion` for tests. Account delete drops the user's rows.
- Routes: `GET/POST /api/planner/terms` (body strict `{version, lang?}`; stale version 400, extra keys 422). Gate called in `PUT listing` and `PUT reviews/[placeSlug]` after body parse, **before the limiter**. Gate is in the routes, not in `requestListing`/`upsertPlannerReview`: 10.5/10.6 new write routes must call `requireTermsAccepted`.
- UI: `components/planner/terms-accept.tsx` in share panel + Planner review form (submit disabled until accepted; 403 reason shows `creatorTerms.required`). `creatorTerms` strings VI/EN.
- Docs: `features/creator-terms.{md,vi.md}`, README rows, architecture, specs-community-database (numbering 0013+ shifted by one), runbook (2 route rows), project-context.

## Fixture / test changes (no assertion edited)
- `tests/review-limiter-routes.test.ts`, `review-limiter-fail-closed.test.ts`: `repo.acceptTerms(...)` line after sign-in.
- `tests/planner-pg-fixtures.ts` `runScenario`: accepts terms (so round-trips cover the table).
- `tests/planner-rows.test.ts`: `'terms_acceptances'` added to the expected delete-order list (new table); `planner-postgres.integration.test.ts`: table added to TRUNCATE + new `creator terms` block; `planner-helpers.ts` `makePlanner` accepts `termsVersion`.

## Not done
- **D5 open (owner):** Terms text NOT changed (still mentions images/video, Q8); Điều 3 untouched. Owner: edit text, bump `termsVersion`, re-pin hash.
- UI at 375/768/1280: NOT RUN (needs a signed-in browser session).

## Checks
typecheck PASS · lint PASS · test PASS: with TEST_DATABASE_URL (local PostgreSQL 14, throwaway cluster) 78 files, 1036 tests; without it 75 files + 3 skipped, 981 passed, 55 skipped. qc / security: NOT RUN (recommend `/sec-check`: CSRF on accept route, table privacy).
