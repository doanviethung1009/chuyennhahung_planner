# Handoff — guest-review-data-removal (class L, branch fix/guest-review-erasure-residuals)
Contract: .claude/contracts/guest-review-data-removal.md (approved, Q1–Q3 defaults). Uncommitted, no PR. 0 subagents, no ADR, no migration.
Done: `eraseGuestReview` now also nulls `reports.note`/`handlerReason` of reports on the review, blanks `reason` of earlier audit events on the review and on its guest restriction (`redactEventReasons`, events.ts; `erase` events kept), sets that restriction's reason to `ERASED_REASON` (key and expiry kept). Cleanup runs on an already-erased row too (backfill), no second `erase` event. Rating stays the placeholder 1. UI warning text VI/EN; docs EN+VI (community-reviews, moderation-events, ADR 0019 note).
Tests: 4 new cases in tests/guest-review-erasure-cases.ts (residue cleared + metadata kept, other data untouched, rating/summary, backfill).
Checks: typecheck PASS; lint PASS; test PASS (84 files, 1101 passed, 82 skipped). PostgreSQL integration: NOT RUN (no TEST_DATABASE_URL; the cases are shared with that file). Browser UI: NOT RUN. /qc-check, /sec-check: NOT RUN (sec-check recommended: irreversible deletion, audit-log exception).
Limits: restriction link uses review.guestKey, so rows erased earlier lose it (≤30 d); backups/WAL/nginx logs out of scope.
Not done: commit/push/PR.
