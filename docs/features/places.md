# Feature — Public places

🇻🇳 Bản tiếng Việt: [places.vi.md](places.vi.md)

## Summary

Visitors can browse the places of a destination and open a page for each one: category, location, description, photos, suggested time, estimated cost, Hưng's rating and note, and the approved traveller reviews with a form to write one (see [community-reviews.md](community-reviews.md)). A signed-in member can add the place to one of their trips (PLACES-UI-S3). Vietnamese is the default; English is a translation.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/places/[slug]` | `/dia-diem/[slug]` | `/en/places/[slug]` |

The "Places" section is on `/destinations/[slug]`. There is no places index page. See [ADR 0026](../adr/0026-public-places-routes.md).

## Data

Reads the `Place` collection of the content repository (`placeInputSchema`) and approved reviews (`getApprovedReviews`). Message namespace `places` (VI and EN). A place has no publish state, so every catalogue place is public. Shown: name, location, category, images, description, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`. Never shown: `affiliateLinks`, timestamps. Seed places and ratings are the owner's content to confirm before launch.

## How it works

`getPublicPlaces(destinationSlug?)` and `getPublicPlace(slug)` in `src/server/content/public-places.ts` project a place to an allow-list. The listing returns `[]` when the store fails, so the destination page hides the section. The detail page returns 404 for an unknown slug and lets a store failure surface as an error. Reviews come from `getApprovedReviews([slug])` and render with `ReviewList`; an empty set shows a short message. Costs under one million đồng are written in full in Vietnamese (`50.000 đ`). Photos get an alt built from the place name and photo number. **Add to trip (PLACES-UI-S3):** `PlaceAddToTrip` reads the session from `GET /api/planner/session`. A visitor gets a sign-in link that returns to the page (`returnTo`). A member opens a panel that lists their active trips to the place's destination (`GET /api/planner?destinationSlug=`, at most 50, no paging), picks a trip and a day, and the page posts `POST /api/planner/[id]/activities` with the place's suggested time and cost (`group` scope, no start time, added at the end of the day). On choosing a trip it also reads `GET /api/planner/[id]` to warn when the place is already in the trip (it can still be added again) and to disable days that already hold 40 activities. 401 goes to sign-in, 404 reloads the list, 409 (trip just archived or day full) and 429 show a message. No API or data change. Pages are `force-dynamic` and the sitemap lists every place (and fails, rather than omitting places, if the store is down) with `hreflang` alternates.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/places/[slug]/page.tsx` | Place detail page, metadata, JSON-LD |
| `src/app/[locale]/destinations/[slug]/page.tsx` | "Places" section |
| `src/server/content/public-places.ts` | Allow-list read of places |
| `src/components/cards/place-card.tsx` | Place card |
| `src/components/places/place-review-section.tsx` | Review form block on the page (PLACES-UI-S2) |
| `src/components/places/place-add-to-trip.tsx`, `add-to-trip-logic.ts` | Add-to-trip panel and its pure helpers (PLACES-UI-S3) |
| `src/lib/place-format.ts` | Duration and cost wording |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route and sitemap |
| `messages/vi.json`, `messages/en.json` | `places` namespace |

## Tests

`tests/places-page.test.ts`: allow-list projection and destination filter, unknown slug, store failure gives an empty list, card markup, route pair, sitemap entry, VI/EN key parity, one `h1` and `notFound()` on the page. `tests/routing.test.ts`, `tests/i18n.test.ts`, `tests/docs.test.ts` and `tests/client-boundary.test.ts` cover the shared rules. `tests/place-add-to-trip.test.ts`: trip filter by destination and status, full and duplicate days, request body and duration clamp, neutral first render with no button, VI/EN key parity of `places.addToTrip`. Not tested automatically: the panel's network flow and the rendered detail page end to end (checked by hand at 375, 768 and 1280 px).

## Limits and open questions

No places index, search or filter, no map, no creating a trip from the page (it links to `/my-trips/new`), no start time or cost edit on adding (edit in the trip editor), no archived trips. The page shows the 20 newest reviews, with no pagination; paging needs a `limit`/`cursor` on `GET /api/community/reviews` (decision PLACES-UI-S2). Only the 50 most recent active trips of the destination are offered. Alt text is generic until the schema has per-image alt. Place coordinates are not shown. Placeholder catalogue places would be public as they are.
