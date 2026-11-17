# Feature — Public places

🇻🇳 Bản tiếng Việt: [places.vi.md](places.vi.md)

## Summary

Visitors can browse the places of a destination and open a page for each one: category, location, description, photos, suggested time, estimated cost, Hưng's rating and note, and the approved traveller reviews (read-only). Vietnamese is the default; English is a translation.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/places/[slug]` | `/dia-diem/[slug]` | `/en/places/[slug]` |

The "Places" section is on `/destinations/[slug]`. There is no places index page. See [ADR 0026](../adr/0026-public-places-routes.md).

## Data

Reads the `Place` collection of the content repository (`placeInputSchema`) and approved reviews (`getApprovedReviews`). Message namespace `places` (VI and EN). A place has no publish state, so every catalogue place is public. Shown: name, location, category, images, description, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`. Never shown: `affiliateLinks`, timestamps. Seed places and ratings are the owner's content to confirm before launch.

## How it works

`getPublicPlaces(destinationSlug?)` and `getPublicPlace(slug)` in `src/server/content/public-places.ts` project a place to an allow-list. The listing returns `[]` when the store fails, so the destination page hides the section. The detail page returns 404 for an unknown slug and lets a store failure surface as an error. Reviews come from `getApprovedReviews([slug])` and render with `ReviewList`; an empty set shows a short message. Costs under one million đồng are written in full in Vietnamese (`50.000 đ`). Photos get an alt built from the place name and photo number. Pages are `force-dynamic` and the sitemap lists every place (and fails, rather than omitting places, if the store is down) with `hreflang` alternates.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/places/[slug]/page.tsx` | Place detail page, metadata, JSON-LD |
| `src/app/[locale]/destinations/[slug]/page.tsx` | "Places" section |
| `src/server/content/public-places.ts` | Allow-list read of places |
| `src/components/cards/place-card.tsx` | Place card |
| `src/lib/place-format.ts` | Duration and cost wording |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route and sitemap |
| `messages/vi.json`, `messages/en.json` | `places` namespace |

## Tests

`tests/places-page.test.ts`: allow-list projection and destination filter, unknown slug, store failure gives an empty list, card markup, route pair, sitemap entry, VI/EN key parity, one `h1` and `notFound()` on the page. `tests/routing.test.ts`, `tests/i18n.test.ts`, `tests/docs.test.ts` and `tests/client-boundary.test.ts` cover the shared rules. Not tested automatically: the rendered detail page end to end (checked by hand at 375, 768 and 1280 px).

## Limits and open questions

No places index, search or filter, no map, no review form (next contract), no add-to-trip button. Alt text is generic until the schema has per-image alt. Place coordinates are not shown. Placeholder catalogue places would be public as they are.
