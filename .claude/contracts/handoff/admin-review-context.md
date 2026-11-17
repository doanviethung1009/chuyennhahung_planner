# Handoff — admin-review-context (class M, branch feat/admin-review-context)
Contract: staff admin shows place NAME (VI/EN) + link, and a guest_limit badge, no browser N+1.
Done (uncommitted, no PR, no ADR needed):
- schemas.ts: `PlaceRef`; `ReviewQueueItem.place`/`guestLimitAt`; `RestrictionListItem.place`.
- repository.ts: `placeRefs()` (one catalog lookup per distinct slug, failure/unknown -> null); `listReviewQueue` folds latest `guest_limit` event time; `listRestrictions` adds place.
- UI: new `place-link.tsx` (link to `/destinations/[slug]`, new tab, sr-only hint, >=44px); used in review-queue + restriction-list; badge + time in queue.
- messages vi/en: adminCommunity.newTab, reviews.guestLimitBadge/guestLimitAt; reviews.meta no longer has {place}.
- Docs: community-reviews + moderation-events (EN+VI). Routes unchanged -> runbook untouched.
Tests: 2 new in tests/community-reviews.test.ts (name+flag, no key/address, no event -> null, unknown slug -> place null). Fixtures changed: none (imports fakeCatalog).
Public place page does not exist; link target is the place's destination page (where its reviews show).
Checks: typecheck PASS, lint PASS, test PASS (83 files, 1087 passed, 73 skipped).
Postgres cases: NOT RUN (no TEST_DATABASE_URL). Browser 375/768/1280: NOT RUN. qc/security: NOT RUN.
Not done: commit/push/PR (awaiting owner). W1–W7, F1 untouched.
