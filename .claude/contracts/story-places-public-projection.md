# Task Contract: STORY-PLACES-PROJ — `PublicStory.places` uses the allow-list
- Class: M (single module, no API shape change) · Branch `fix/story-places-public-projection`, stacked on `fix/places-api-public-projection` (PR #185, provides `toPublicPlace`). Origin: /sec-check warning 1 on #185.
- Outcome: story pages never hold `affiliateLinks`, timestamps or `coords` of a place.
- Scope IN: `src/server/content/public.ts` (`PublicStory.places: PublicPlace[]`, project in `toPublicStory`), `src/components/story/story-blocks.tsx` (prop types), test in `tests/public-content.test.ts`, `docs/features/places.*`.
- Scope OUT: API routes, admin, schemas, story page markup.
- Evidence: consumers of `story.places` are `story-blocks.tsx` (reads slug, name, location, suggestedMinutes, estimatedCostVnd) and `PlaceCard`; `[locale]/stories/[slug]/page.tsx:82,159,170` only slug/PlaceCard; no `'use client'` component receives a place. All used fields are in `PublicPlace`.
- Risks: none functional; type change only. Rollback: revert.
- Budget: subagents 0. State: DONE (merged PR #187, 2026-11-19)
