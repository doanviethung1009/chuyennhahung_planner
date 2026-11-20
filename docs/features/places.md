# Feature — Public places

🇻🇳 Bản tiếng Việt: [places.vi.md](places.vi.md)

## Summary

Visitors can browse the places of a destination and open a page for each one: category, location, description, photos, suggested time, estimated cost, Hưng's rating and note, and the approved traveller reviews with a form to write one (see [community-reviews.md](community-reviews.md)). A signed-in member can add the place to one of their trips (PLACES-UI-S3). Vietnamese is the default; English is a translation.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/places` | `/dia-diem` | `/en/places` |
| `/places/[slug]` | `/dia-diem/[slug]` | `/en/places/[slug]` |

`/places` (`/dia-diem`, `/en/places`) is the searchable list (PLACES-UI-S6); the "Places" section is also on `/destinations/[slug]`. See [ADR 0026](../adr/0026-public-places-routes.md).

## Data

Reads the `Place` collection of the content repository (`placeInputSchema`) and approved reviews (`getApprovedReviews`). Message namespace `places` (VI and EN). A place has no publish state, so every catalogue place is public. Shown: name, location, category, images, description, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`. Never shown: `affiliateLinks`, timestamps. Seed places and ratings are the owner's content to confirm before launch.

## How it works

`getPublicPlaces(destinationSlug?)` and `getPublicPlace(slug)` in `src/server/content/public-places.ts` project a place to an allow-list. The listing returns `[]` when the store fails, so the destination page hides the section. The detail page returns 404 for an unknown slug and lets a store failure surface as an error. Reviews come from `getApprovedReviews([slug])` and render with `ReviewList`; an empty set shows a short message. Costs under one million đồng are written in full in Vietnamese (`50.000 đ`). Photos get an alt built from the place name and photo number. **Add to trip (PLACES-UI-S3):** `PlaceAddToTrip` reads the session from `GET /api/planner/session`. A visitor gets a sign-in link that returns to the page (`returnTo`). A member opens a panel that lists their active trips to the place's destination (`GET /api/planner?destinationSlug=`, at most 50, no paging), picks a trip and a day, and the page posts `POST /api/planner/[id]/activities` with the place's suggested time and cost (`group` scope, no start time, added at the end of the day). On choosing a trip it also reads `GET /api/planner/[id]` to warn when the place is already in the trip (it can still be added again) and to disable days that already hold 40 activities. 401 goes to sign-in, 404 reloads the list, 409 (trip just archived or day full) and 429 show a message. No API or data change. Pages are `force-dynamic` and the sitemap lists every place (and fails, rather than omitting places, if the store is down) with `hreflang` alternates.

**List page (PLACES-UI-S6):** `/places` is server-rendered from `searchParams`: `q` (name or location, any language, with or without diacritics — "da lat" and "Đà Lạt" find the same places), `destination`, `category` and `page` (24 per page). The search is a plain GET `<form>` (works without JavaScript); an unknown destination or category is dropped, `q` is trimmed and cut to 80 characters, a bad `page` becomes 1 and a page past the end shows the last one. `searchPublicPlaces` in `src/server/content/public-places.ts` filters and pages the cached catalogue (see **Load and caching** below; the match rule is the one `listPlaces` uses for `q`, API: see [travel-content-api.md](../travel-content-api.md)), and rejects on a store failure (the page errors instead of showing "no results"). Paging links are real `<a>` and keep `q` and the filters. Cards reuse `PlaceCard`; headings are `h1` → sr-only `h2` "Results" → `h3` per card. Count, empty state and "Clear filters" are shown. SEO: the bare first page is indexable; any page with `q`, a filter or `page > 1` is `noindex, follow` with the canonical set to `/places`; `/places` is in the sitemap in both languages. `q` is never logged and is rendered only through React (escaped). Linked from the destinations index (a "Browse all places" link) and the footer "Explore" column. Catalogue size today: 6 seed places; the substring scan is fine up to a few thousand, beyond that move the search to the store.

**Load and caching (places-list-load):** the public read no longer loops over `listPlaces` 100 at a time on every request. `src/server/content/public-places.ts` reads the whole catalogue in one `listPlaces` call, projects it to `PublicPlace`, and keeps that list in memory for `CATALOGUE_TTL_MS` = 10 seconds (`src/server/public-catalogue-cache.ts`, shared through `globalThis`). `q`, `destination`, `category` and `page` are applied to that list, so any number of different searches costs one store read per window. Concurrent requests share the same read; a failed read is never cached, so a store outage still rejects (page error, sitemap failure). Freshness: after any state-changing request in this process, `invalidateOverviewCacheAfter` drops the cache, so an admin edit or delete shows at once; another instance sees it within 10 seconds. The page stays `force-dynamic` (it depends on `searchParams`), and no rate limit was added: the repository limiter is per process and keyed by a spoofable header, and the read no longer scales with request volume. No change to `GET /api/travel/places`, the JSON shape, the `noindex` rule or the allow-list. No ADR is needed (ADR 0026 does not fix the read path).

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/places/[slug]/page.tsx` | Place detail page, metadata, JSON-LD |
| `src/app/[locale]/destinations/[slug]/page.tsx` | "Places" section |
| `src/server/content/public-places.ts` | Allow-list read of places and `searchPublicPlaces` |
| `src/server/public-catalogue-cache.ts` | 10-second in-memory catalogue cache and its invalidation |
| `src/app/[locale]/places/page.tsx` | List page, `noindex` rule (PLACES-UI-S6) |
| `src/components/places/places-list-params.ts`, `places-filter-form.tsx`, `places-pagination.tsx` | Query parsing, GET form, paging links |
| `src/lib/fold.ts` | Shared case/diacritic folding (also used by `slugify`) |
| `src/components/cards/place-card.tsx` | Place card |
| `src/components/places/place-review-section.tsx` | Review form block on the page (PLACES-UI-S2) |
| `src/components/places/place-add-to-trip.tsx`, `add-to-trip-logic.ts` | Add-to-trip panel and its pure helpers (PLACES-UI-S3) |
| `src/lib/place-format.ts` | Duration and cost wording |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route and sitemap |
| `messages/vi.json`, `messages/en.json` | `places`, `placesList` namespaces, `nav.places` |

## Tests

`tests/places-page.test.ts`: allow-list projection and destination filter, unknown slug, store failure gives an empty list, card markup, route pair, sitemap entry, VI/EN key parity, one `h1` and `notFound()` on the page. `tests/places-search.test.ts` (folding incl. `đ`, `listPlaces` with `q` before paging, `q` bounds and 422, route `GET /api/travel/places?q=`) and `tests/places-list-page.test.ts` (routing map, sitemap entry, noindex rule, link query, key parity). `tests/routing.test.ts`, `tests/i18n.test.ts`, `tests/docs.test.ts` and `tests/client-boundary.test.ts` cover the shared rules. `tests/place-add-to-trip.test.ts`: trip filter by destination and status, full and duplicate days, request body and duration clamp, neutral first render with no button, VI/EN key parity of `places.addToTrip`. Not tested automatically: the panel's network flow and the rendered detail page end to end (checked by hand at 375, 768 and 1280 px).

## Limits and open questions

Content seen by visitors can be up to 10 seconds old when the edit happened on another instance (the editing instance is fresh at once); the cache holds one projected catalogue per process. Search is substring-only (no ranking, typo tolerance, autocomplete or sorting); no rating filter; no map, no creating a trip from the page (it links to `/my-trips/new`), no start time or cost edit on adding (edit in the trip editor), no archived trips. The page shows the 20 newest reviews, with no pagination; paging needs a `limit`/`cursor` on `GET /api/community/reviews` (decision PLACES-UI-S2). Only the 50 most recent active trips of the destination are offered. Alt text is generic until the schema has per-image alt. Place coordinates are not shown. Placeholder catalogue places would be public as they are.

**Public API (PLACES-API-PROJ).** `GET /api/travel/places` and `/[slug]` return the same allow-list as the pages (`toPublicPlace`); no `affiliateLinks`, timestamps or `coords`. Test: `tests/places-api-public-projection.test.ts`.

**Story pages (PLACES-API-PROJ follow-up).** `PublicStory.places` holds `PublicPlace` (via `toPublicPlace`), so a story page and its RSC payload never carry `affiliateLinks`, timestamps or `coords`. Test: `tests/public-content.test.ts`.
