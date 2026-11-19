# Handoff — STORY-PLACES-PROJ (2026-11-19)
- Branch `fix/story-places-public-projection`, stacked on #185 (needs `toPublicPlace`). Not committed/pushed yet.
- `PublicStory.places` is now `PublicPlace[]` (`src/server/content/public.ts`); `story-blocks.tsx` types follow. Used fields all in the allow-list; no client component receives places.
- Test added in `tests/public-content.test.ts`; docs note in `docs/features/places.*`.
- Checks: see report. qc / sec-check NOT RUN.
- Merge order: #185 first, then retarget this PR to main.
