# Handoff — REVIEWS-API-PROJ (2026-11-22)
- Branch `fix/reviews-public-api-projection` from `main`. NOT committed/pushed/PR'd — waiting for the owner.
- Owner decisions: E1a exactly `PublicReview` (7 fields); E2 `author`/`costVnd` stay out; E3 collections and templates audited separately.
- `src/app/api/travel/reviews/route.ts` maps the published list through `toPublicReview` (shared with the story page). Admin review routes keep the full record.
- BREAKING for any external client reading status, publishedAt, timestamps, subject, costVnd, author; repo has none. Say so in the PR.
- Test: `tests/travel-content-api.test.ts` (exact 7 keys, no forbidden fields/values, draft absent, `?status=draft` cannot widen).
- Docs EN+VI: public review paragraph in `docs/travel-content-api(.vi).md`.
- Checks: see report. `/qc-check`, `/sec-check` NOT RUN (sec-check recommended).
- Open: `/api/travel/collections*` and `/api/travel/templates*` return stored records (templates carry `sourceSnapshot.actualCostTotalVnd`, `version`, timestamps) — own contract; W1 `cost` blocks in story content and W2 `personalNote` await owner.
