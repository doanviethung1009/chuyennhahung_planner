# Feature — More destinations

🇻🇳 Bản tiếng Việt: [more-destinations.vi.md](more-destinations.vi.md)

## Summary

Adds eight destinations we have **not visited yet** (Hà Nội, Quảng Ninh/Hạ Long, Quảng Bình/Phong Nha, Đà Nẵng, Quy Nhơn, Nha Trang, TP. Hồ Chí Minh, Cần Thơ) so readers can browse and plan around more of Vietnam, plus two public-landmark places for each of them and for Hội An, Sa Pa, Hà Giang and Huế. Unvisited destinations carry objective information only — never an invented first-person account, visit date or visit count.

## Routes

None. Uses the existing `/destinations/[slug]` (`/kham-pha/[slug]`), `/places/[slug]` (`/dia-diem/[slug]`) and `/map` (`/ban-do`) routes. The `/tour*` redirects are untouched.

## Data

- `Destination.firstVisited` and `Destination.visits` are now optional; `isVisited()` in `src/content/types.ts` is the single test. A destination without them is "not visited yet".
- `body` stays required: for an unvisited destination it is objective description ending with a line saying we have not been there.
- New messages: `common.notVisited`, `map.legendNotVisited`; `destinations.description` reworded.
- Places live in `src/content/travel/seed-places.ts` and are part of `demoPlaces`. `rating` and `personalNote` are `null` (the owner's own experience). `suggestedMinutes` and `estimatedCostVnd` are **estimates to confirm**; coordinates are approximate landmark centroids. Owner action: confirm prices and fill in ratings and notes after visiting.
- Covers are abstract SVGs from `scripts/generate-covers.mjs`, not photography.

## How it works

The destination card shows a "Not visited yet" badge instead of the visit count; the detail page hides the "first visited" date and shows "Not visited yet" in the visits cell; `/map` lists "Not visited yet" and draws a hollow pin of the minimum radius (`pinRadius(undefined)` is 5). Unvisited destinations are appended after the visited ones so the home page (first four) is unchanged. `seedTravelContent` only seeds an empty store, so an existing store gets the places with `npm run content:seed-places` (create-only, `--dry-run` supported; see `docs/usage.md`). Not run against any real store by this change.

## Files

| Path | Role |
|---|---|
| `src/content/types.ts` | optional fields, `isVisited()` |
| `src/content/destinations.ts` | eight new destinations |
| `src/content/travel/seed-places.ts` | landmark places and the top-up function |
| `src/content/travel/seed.ts` | `demoPlaces` now includes them |
| `scripts/content-seed-places.ts` | top-up command |
| `scripts/generate-covers.mjs`, `public/images/covers/*.svg` | covers |
| `src/components/cards/destination-card.tsx`, `src/components/map/vietnam-map.tsx`, `src/lib/map.ts`, `src/app/[locale]/map/page.tsx`, `src/app/[locale]/destinations/[slug]/page.tsx` | rendering of unvisited state |

## Tests

`tests/destinations-unvisited.test.ts` asserts no invented dates or counts, the honesty line in both languages, covers exist, at least two places per destination, known destination slugs, `rating`/`personalNote` null, and an idempotent create-only top-up. `tests/travel-content-acceptance.test.ts` now counts `demoPlaces.length`. Existing map, content and i18n tests cover the rest.

## Limits and open questions

- Costs, durations and coordinates are estimates and need the owner's confirmation; ratings and notes are intentionally empty.
- Destination text is general knowledge, not first-hand; replace it after a visit (then add `visits` and `firstVisited`).
- Existing stores need `content:seed-places` run by hand.
- `qc` and `security` were not run.
