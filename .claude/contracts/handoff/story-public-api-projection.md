# Handoff — STORY-API-PROJ (2026-11-22)
- Branch `fix/story-public-api-projection` from `main`. NOT committed/pushed/PR'd — waiting for the owner.
- Owner decisions: D1a drop `actualCost` from `PublicStory`; D2a allow-list for `/api/travel/stories*`; D3 `/api/travel/reviews` (raw review) is a separate contract, not done.
- `src/server/content/public-story-api.ts` (new): `toPublicStoryRecord`, 14 fields; both story routes use it. `public.ts`: `actualCost` removed. Admin routes keep the full record.
- BREAKING for any external client of the old JSON (status, createdAt, actualCost(+TotalVnd), placeSlugs, reviewIds, itinerarySlugs gone); repo has no such client. Say so in the PR.
- Tests: `tests/travel-content-api.test.ts` (exact keys, list + detail, no cost/status), `tests/public-content.test.ts` (no `actualCost`).
- Docs EN+VI: `travel-content-api`, `features/public-travel-cms`, ADR 0012 public-view column.
- Checks: see report. `/qc-check`, `/sec-check` NOT RUN (sec-check recommended: public API shape).
- Open: reviews API raw; `getPublicTemplate`, collections and templates routes not audited; W2 `personalNote`.
