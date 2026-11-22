# Handoff — STORY-REVIEWS-PROJ (2026-11-22)
- Branch `fix/story-reviews-public-projection` from `main` (4810f6d). NOT committed, pushed or PR'd — waiting for the owner.
- `PublicStory.reviews` is now `PublicReview[]` via `toPublicReview` (`src/server/content/public.ts`): id, title, rating, visitedOn, body, pros, cons. `author` left out by the owner's decision; page markup unchanged (it reads only those 7).
- Test: `tests/public-content.test.ts` (exact 7 keys on detail and list, no forbidden fields in JSON, draft exclusion already covered by the older test).
- Docs: note appended to `docs/features/stories.md` and `.vi.md`.
- Checks after `npm ci`: typecheck, lint, build clean; test 126 files passed | 4 skipped, 1536 passed | 96 skipped.
- `/qc-check` and `/sec-check` NOT RUN. Not covered: `getPublicTemplate` fields (own contract), W2 `personalNote` (owner decision).
- No backlog ID assigned.
