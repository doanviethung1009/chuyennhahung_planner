# Task Contract: STORY-API-PROJ — `actualCost` and the raw public stories API
- Class: L (changes a public JSON shape, so the owner decides first) · Proposed branch `fix/story-public-api-projection`, cut from the latest `main`. Origin: /sec-check on PR #218, out-of-scope notes. Same leak class as places (ADR 0026, #185) and story places/reviews (#187, #218).
- Outcome: no public surface (story page, RSC payload, `/api/travel/stories*`) carries a story field the public does not need; one shared projection feeds both.

## Evidence (read, not yet run)
1. **`actualCost` in `PublicStory`.** `public.ts` copies `story.actualCost` (full `TripCost`: `partySize`, `breakdown[]` with category, bilingual label, `amountVnd`, `note`). ADR 0012 table lists it for the public view, but **no page reads it**: grep of `src/app` and `src/components` finds no use, and `docs/features/public-travel-cms.md:48` says it is "not rendered (no agreed layout for the cost summary)". The story page is a server component, so it does not reach the RSC payload today; it is dead data that a future client component could leak by accident.
2. **`GET /api/travel/stories` and `/[slug]`** return the stored `TravelStory` as is (`src/app/api/travel/stories/route.ts:11`, `[slug]/route.ts:13`): content blocks, `actualCost` and `actualCostTotalVnd`, `status`, `publishedAt`, `createdAt`, `updatedAt`, `placeSlugs`, `reviewIds`, `itinerarySlugs`, `travelStyle`, `seo`. Drafts are already a 404. Repo consumers: only tests (`tests/travel-content-api.test.ts:206-226`, `tests/places-search.test.ts:102`); no page or e2e reads it. The shape is documented in `docs/travel-content-api.md:85`, so an external client may depend on it.
3. **Same pattern elsewhere, not audited:** `GET /api/travel/reviews` returns raw `TravelReview` (`author`, `costVnd`, `subject`, timestamps); `collections` and `templates` not read. `places` already uses `toPublicPlace`.

## Owner decisions needed before code
- D1 `actualCost`: **(a) drop it from `PublicStory`** (default, nothing reads it; re-add with a design when the cost summary is built) or (b) keep it, projected to `{ partySize, breakdown[{ category, label, amountVnd }], note }`.
- D2 Story API shape: **(a) allow-list** `PublicStoryApi` (default) — `slug`, `title`, `excerpt`, `content`, `cover`, `gallery`, `destinationSlug`, `plannerTemplateSlug`, `travelDates`, `travelStyle`, `readingMinutes`, `publishedAt`, `updatedAt`, `seo`; drops `status`, `createdAt`, `actualCost`, `actualCostTotalVnd`, `placeSlugs`, `reviewIds`, `itinerarySlugs` (D1 b would keep a projected `actualCost`) — or **(b) leave as is** and only document that the endpoint exposes the stored record. (a) is a breaking change for any external client; the repo has none.
- D3 Scope of `/api/travel/reviews` (raw `author`, `costVnd`, `subject`, timestamps): include here, or a separate contract (default: separate, same pattern as `toPublicReview`).

## Plan (if D1a + D2a)
- `src/server/content/public.ts`: remove `actualCost` from `PublicStory` and `toPublicStory`/static adapter.
- New `toPublicStoryRecord` (own file `public-story-api.ts`, mirroring `public-places.ts`) used by both story routes; `getPublishedStory` stays the read, projection applied in the route.
- Tests: exact key set on list and detail; JSON matches none of `actualCost|status|createdAt|placeSlugs|reviewIds|itinerarySlugs`; draft still 404; update the assertions in `tests/travel-content-api.test.ts` that read the old shape; `PublicStory` has no `actualCost`.
- Docs EN + VI: `docs/travel-content-api.md` (public story response), `docs/features/public-travel-cms.md`, ADR 0012 table row (short note, or a new ADR if the owner wants the shape change recorded — it changes a documented public contract), same headings in both twins.
- Scope OUT: admin story routes (full record stays there), schemas, story page markup, templates, collections, reviews API (D3).
- Risks: external client of the old JSON breaks (D2a); mitigate by announcing in the PR and docs. Rollback: revert.
- Done when `typecheck`, `lint`, `test`, `build` pass with output stated; `/sec-check` recommended, NOT RUN unless requested. Handoff ≤25 lines in `.claude/contracts/handoff/`.
- Budget: single agent, subagents 0. State: IMPLEMENTED on branch, not committed. Owner decisions: D1a (drop actualCost), D2a (allow-list API), D3 (reviews API is a separate contract). No backlog ID assigned
