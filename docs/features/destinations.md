# Feature — Destinations

🇻🇳 Bản tiếng Việt: [destinations.vi.md](destinations.vi.md)

## Summary

Places the family has actually been, framed as "destinations we've explored"
rather than a list of products. A destination is the hub that stories,
itineraries and video reviews all point at, and the anchor for the travel map.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/destinations` | `/kham-pha` | `/en/destinations` |
| `/destinations/[slug]` | `/kham-pha/[slug]` | `/en/destinations/[slug]` |

## Data

[`src/content/destinations.ts`](../../src/content/destinations.ts) — 8 items of
type `Destination`: `slug`, `name`, `area`, `region` (`north` / `central` /
`south`), `terrain` (mountain, coast, island, city, countryside, highland),
`coords`, `summary`, `body`, `bestSeason`, `firstVisited`, `visits`, `tags`,
`cover`.

Two fields must be **real, not plausible**:

- `coords` are WGS84 latitude/longitude. The map projects them, so a wrong value
  places a confident-looking pin in the wrong province.
- `area` is deliberately geographic ("Đông Bắc", "Cao nguyên đá Đồng Văn") rather
  than administrative, so it survives province reorganisations.

`firstVisited` and `visits` carry the "we were there" framing and drive pin size
on the map.

Helpers: `destinationBySlug`, `getDestination(slug)`.

## How it works

Both pages are server components; the detail page prerenders every slug per
locale through `generateStaticParams` and calls `notFound()` on an unknown slug.

The detail page composes the cross-references in one direction only: it asks
`getStoriesForDestination` and `getItinerariesForDestination` for everything that
points at this destination, so a new story appears on its destination page with
no edit to the destination. Video reviews resolve through `destinationSlug`.

`TouristDestination` JSON-LD is emitted, carrying the real coordinates as
`GeoCoordinates` and the region as a `PostalAddress`.

## Files

| Path | Role |
|---|---|
| [`src/app/[locale]/destinations/page.tsx`](../../src/app/[locale]/destinations/page.tsx) | Index |
| [`src/app/[locale]/destinations/[slug]/page.tsx`](../../src/app/[locale]/destinations/[slug]/page.tsx) | Detail, cross-references, JSON-LD |
| [`src/components/cards/destination-card.tsx`](../../src/components/cards/destination-card.tsx) | Card |
| [`src/components/sections/explored-destinations.tsx`](../../src/components/sections/explored-destinations.tsx) | Home-page section |
| [`src/content/destinations.ts`](../../src/content/destinations.ts) | Seed data + lookups |

## Tests

- `tests/content.test.ts` — unique URL-safe slugs, every `Localized<T>` field
  filled in both locales, `cover` exists on disk.
- `tests/map.test.ts` — every destination has coordinates inside Vietnam's real
  bounds, and every projected pin lands inside the visible frame.

## Limits and open questions

No filtering by region or terrain, although both fields exist and the UI would be
cheap — at eight destinations a filter bar is more chrome than help. There is no
reverse index: the cross-reference lookups scan the collections on every build,
which is free at this size and would need a map past a few hundred items.

Covers are generated SVG. `bestSeason` is editorial prose, not structured data,
so it cannot be filtered on without a schema change.
