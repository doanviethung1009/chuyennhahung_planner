# Feature — Itineraries (and the tour routes)

🇻🇳 Bản tiếng Việt: [itineraries.vi.md](itineraries.vi.md)

## Summary

Day-by-day plans for trips we have actually run. **An itinerary *is* the tour
entity for this site** — it already carries duration, indicative price, group
size and pace, so there is no separate "tour" model and the legacy tour URLs
redirect here.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/itineraries` | `/len-lich-trinh` | `/en/itineraries` |
| `/itineraries/[slug]` | `/len-lich-trinh/[slug]` | `/en/itineraries/[slug]` |

Permanent (308) redirects in [`next.config.ts`](../../next.config.ts):

```
/tour, /tours              → /len-lich-trinh
/tour/:slug, /tours/:slug  → /len-lich-trinh/:slug
/en/tour, /en/tours        → /en/itineraries
/en/tour/:slug             → /en/itineraries/:slug
```

**These redirects are permanent in the contractual sense too.** Removing or
repointing them requires an approved ADR — a 308 is cached by browsers and
search engines, so a mistake here is expensive to undo.

## Data

[`src/content/itineraries.ts`](../../src/content/itineraries.ts) — 4 items of
type `Itinerary`: `slug`, `title`, `summary`, `days`, `nights`, `priceFromVnd`
(indicative, per person, VND), `groupSize`, `pace` (`relaxed` / `balanced` /
`active`), `bestFor`, `destinationSlugs`, `highlights`, `dayByDay`
(`ItineraryDay[]` with `day`, `title`, `detail`), `cover`, `featured`.

Helpers: `itineraryBySlug`, `getItinerary(slug)`,
`getItinerariesForDestination(destinationSlug)`.

`priceFromVnd` is an **indicative** figure, not a quote. It is rendered through
`formatVnd`, which in Vietnamese abbreviates to "triệu đ" the way Vietnamese
travel writing does, and in English falls back to `Intl.NumberFormat` currency.

## How it works

Server components throughout. The index lists every itinerary with duration,
price-from and pace, and can be narrowed to one province with `?province=`
(`parseItineraryProvince` in `src/lib/itineraries-filter.ts`). An itinerary belongs
to a province when any destination in its `destinationSlugs` does. The chips are
plain links rendered by `ProvinceFilterNav`, offering only provinces that match at
least one itinerary, so no chip leads to an empty list; the count follows the
filter, unknown values fall back to the full list, and a filtered URL is
`noindex, follow` with the canonical on the bare list. Because the index now reads
`searchParams`, it renders per request instead of being prerendered.

 the detail page renders `highlights`, then `dayByDay` as an
ordered list, then the destinations it covers. Unknown slug → `notFound()`.

`generateStaticParams` prerenders every slug per locale. `dayByDay` is validated
by test rather than by convention: days must be numbered consecutively from 1 and
their count must equal the `days` field, so a plan cannot silently disagree with
its own headline.

## Files

| Path | Role |
|---|---|
| [`src/app/[locale]/itineraries/page.tsx`](../../src/app/[locale]/itineraries/page.tsx) | Index |
| [`src/app/[locale]/itineraries/[slug]/page.tsx`](../../src/app/[locale]/itineraries/[slug]/page.tsx) | Detail, day-by-day, JSON-LD |
| [`src/lib/itineraries-filter.ts`](../../src/lib/itineraries-filter.ts) | `?province=` validation, itinerary → province |
| [`src/components/ui/province-filter-nav.tsx`](../../src/components/ui/province-filter-nav.tsx) | Province chips |
| [`src/components/cards/itinerary-card.tsx`](../../src/components/cards/itinerary-card.tsx) | Card |
| [`src/components/sections/featured-itineraries.tsx`](../../src/components/sections/featured-itineraries.tsx) | Home-page section |
| [`src/content/itineraries.ts`](../../src/content/itineraries.ts) | Seed data + lookups |
| [`next.config.ts`](../../next.config.ts) | Tour → itinerary redirects |
| [`src/lib/format.ts`](../../src/lib/format.ts) | `formatVnd` |

## Tests

`tests/itineraries-province-filter.test.ts` — parsing, every chip non-empty,
every itinerary reachable. `tests/content.test.ts` — unique URL-safe slugs, `destinationSlugs` resolve,
every `Localized<T>` field complete, `cover` on disk, and itinerary days
numbered consecutively from 1 and matching `days`. The redirect table itself is
not unit-tested (it is Next.js config, not code); `npm run build` is what proves
it loads.

## Limits and open questions

No booking, no availability, no enquiry form — that is the Planner phase, and
`/thiet-ke-chuyen-di` is the real contact route until it opens. See
[plan-your-trip.md](plan-your-trip.md).

Prices are static numbers in a TypeScript file, so they go stale silently and a
change needs a rebuild. If prices start moving, they want a dated field and a
visible "as of" date rather than a quiet edit.

Province is the only filter; four itineraries need none by pace or duration, though both fields exist
for it.
