# Feature — Travel map

🇻🇳 Bản tiếng Việt: [travel-map.vi.md](travel-map.vi.md)

## Summary

A stylised map of Vietnam with a pin on every destination the family has visited.
It answers "where have you actually been?" at a glance, and it works with
JavaScript disabled — no tiles, no map library, no API key.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/map` | `/ban-do` | `/en/map` |

A smaller `preview` variant of the same component appears on the home page.

## Data

The `coords` field on every `Destination` — real WGS84 latitude/longitude — plus
`visits`, which sets pin size. Nothing else: the outline is a constant in
[`src/lib/map.ts`](../../src/lib/map.ts), not a data file.

## How it works

`lib/map.ts` is a pure module with three exports that matter:

- `project(lat, lng)` — an equirectangular projection into a 420×820 frame with
  18px padding, bounded to `lat 8.2–23.6`, `lng 101.9–110.0`. Coarse, but
  truthful at the scale we draw.
- `VIETNAM_OUTLINE_PATH` — a 33-point national boundary, converted Catmull-Rom →
  cubic Bézier and computed once at module load, so the coarse point list renders
  as a smooth closed silhouette instead of a polygon.
- `pinRadius(visits)` — `5 + visits * 1.4`, capped at 11, so a frequently visited
  place reads as bigger without dominating the map.

The component is a **server** component. The silhouette `<path>` is
`aria-hidden`, and the pins are a `<ul>` of real `next-intl` `Link` anchors
absolutely positioned over it. That is the whole accessibility and SEO story: a
crawler sees links to eight destination pages, and a keyboard user tabs through
them in order.

On the full map (`/map`) only **featured** destinations (`featured: true` in
`src/content/destinations.ts`, owner-curated, independent of `visits`) keep a
permanent name label; every other pin shows its name as a tooltip on hover or
keyboard focus, as the home preview does. The name stays in the anchor's
accessible name either way. This keeps dense clusters (Hà Nội / Ninh Bình /
Hạ Long, Huế / Hội An / Đà Nẵng) readable at 375px. On touch there is no hover,
so a tap opens the destination page, whose heading carries the name.

The simplification is deliberate and stated: the coastline is stylised, the pins
are not. A pin's position is always computed from the destination's real
coordinates.

## Files

| Path | Role |
|---|---|
| [`src/lib/map.ts`](../../src/lib/map.ts) | Projection, outline path, pin radius |
| [`src/components/map/vietnam-map.tsx`](../../src/components/map/vietnam-map.tsx) | SVG + anchored pins, `full` / `preview` variants |
| [`src/app/[locale]/map/page.tsx`](../../src/app/[locale]/map/page.tsx) | Map page |
| [`src/components/sections/map-preview.tsx`](../../src/components/sections/map-preview.tsx) | Home-page preview |

## Tests

`tests/map.test.ts` asserts every destination projects inside the visible frame,
that north stays above south and east right of west (the projection is not
flipped), that every destination has coordinates within Vietnam, that the outline
path is closed, that pin growth is capped, that only featured pins render a permanent label (the rest keep the name as `sr-only` text plus a focus tooltip), and that the featured set matches the owner-approved list.

## Limits and open questions

The outline is a silhouette, not a survey map — no provinces, no borders, no
labels beyond the destination names, and no zoom or pan. The bounds are hard-coded
to mainland Vietnam: a destination outside them (Côn Đảo far south, or anywhere
abroad) would be clamped visually and `tests/map.test.ts` would catch it.

Pins can overlap where two destinations are close together; at eight items they
do not, and a real solution means either collision handling or clustering.
