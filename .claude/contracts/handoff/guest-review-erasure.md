# Handoff — guest-review-erasure (class L, branch feat/guest-review-erasure, ADR 0024 §8)
Contract: .claude/contracts/guest-review-erasure.md. Uncommitted, no PR (awaiting owner). No ADR, no migration, 0 subagents.
Done:
- `community:erase` (admin, super_admin, service; not editor) — permissions.ts.
- `repository.eraseGuestReview` (repository.ts ~2051): in-place anonymise (body → ERASED_REVIEW_BODY, authorName/guestKey/rejectReason null, visitedOn = created date, rating 1, status removed), one `erase` event, idempotent, homepage only, any status.
- `POST /api/admin/community/reviews/[id]/erase` {reason 3–500}; same-origin for cookies, no-store; 422/404/409 as in tests. `ReviewQueueItem.erased`; button + accessible confirm form (warning, reason help) in review-queue.tsx; mute hidden once erased. VI/EN strings.
- Docs EN+VI: community-reviews, moderation-events, runbook, architecture, ADR 0024 Follow-up line, project-context.
Tests: new guest-review-erasure-cases.ts (memory + PG), guest-review-erasure.test.ts (route). Fixtures changed: planner-roles.test.ts matrix (+community:erase), planner-postgres.integration.test.ts (+1 describe). No other change.
Checks: typecheck PASS; lint PASS; test PASS (84 files, 1093 passed, 78 skipped). PostgreSQL integration PASS 62/62 against a local temp PostgreSQL (TEST_DATABASE_URL). Browser/UI 375–1280: NOT RUN.
QC self-review: PASS_WITH_WARNINGS. NOT VERIFIED: UI focus/keyboard flow in a browser.
Security self-review: PASS_WITH_WARNINGS (no BLOCKED).
- W-a: `reports.note` (reporter free text, schemas.ts note ≤2000) may quote the erased text and is not erased; follow-up if owner wants it cleared on erase.
- W-b: earlier audit `reason`s (staff text) on the review remain; UI warns, cannot enforce.
- W-c: backups, PostgreSQL dead tuples/WAL, nginx logs not covered (stated in docs).
- W-d: no staff-write rate limit exists on admin routes (none added).
Open question for owner: `rating` reset to 1 (chosen) vs keep original.
Recommend /sec-check before merge (irreversible deletion): NOT RUN. Not done: commit/push/PR; W1–W7, F1 untouched.
