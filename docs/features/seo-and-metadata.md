# Feature — SEO and metadata

🇻🇳 Bản tiếng Việt: [seo-and-metadata.vi.md](seo-and-metadata.vi.md)

## Summary

Every page ships a canonical URL, a complete `hreflang` set, Open Graph and
Twitter cards, and JSON-LD where a schema.org type fits. This is structural here,
not a polish pass: a bilingual site with two URLs per page is a duplicate-content
problem unless the alternates are right.

## Routes

Three locale-independent routes sit outside `[locale]` and are excluded by the
middleware matcher:

| Route | Output |
|---|---|
| `/robots.txt` | [`src/app/robots.ts`](../../src/app/robots.ts) |
| `/sitemap.xml` | [`src/app/sitemap.ts`](../../src/app/sitemap.ts) |
| `/opengraph-image` | [`src/app/opengraph-image.tsx`](../../src/app/opengraph-image.tsx) |

## Data

`siteConfig.url` from [`src/content/site.ts`](../../src/content/site.ts), which
reads `NEXT_PUBLIC_SITE_URL` and falls back to `https://chuyennhahung.vn`. **It
is baked in at build time** — every canonical, alternate and sitemap entry is
absolute, so building with the wrong value publishes the wrong URLs.

Titles and descriptions come from the message catalogues; per-item metadata comes
from the content collections (`publishedAt` becomes `datePublished`, `cover`
becomes the OG image, destination `coords` become `GeoCoordinates`).

## How it works

[`src/lib/metadata.ts`](../../src/lib/metadata.ts) has two exports:

- `buildAlternates(href, locale)` — the canonical plus one `languages` entry per
  locale, with **`x-default` pointing at Vietnamese** because Vietnamese is the
  primary audience.
- `buildPageMetadata({ href, locale, title, description, image, type,
  publishedTime })` — the above plus Open Graph (`locale` mapped to `vi_VN` /
  `en_GB`, a 1200×630 image, `publishedTime` for articles) and a
  `summary_large_image` Twitter card.

Every page exports `generateMetadata` and calls it. URLs are built by
`getPathname` from `src/i18n/navigation.ts`, so a localized pathname change
propagates into canonicals, alternates and the sitemap without a second edit.

`sitemap.ts` emits one entry per page carrying the full alternate set: eight
static pages plus every story, destination and itinerary, with `priority` and
`changeFrequency` per type and `lastModified` from a story's `publishedAt`.

JSON-LD goes through [`json-ld.tsx`](../../src/components/seo/json-ld.tsx), a
one-line component that serialises a plain object into
`<script type="application/ld+json">` — `Article` for stories,
`TouristDestination` for destinations, `TouristTrip` with a day-by-day `ItemList`
for itineraries, and `Organization` on the about page.

## Files

| Path | Role |
|---|---|
| [`src/lib/metadata.ts`](../../src/lib/metadata.ts) | Canonical + `hreflang` + OG/Twitter builder |
| [`src/app/sitemap.ts`](../../src/app/sitemap.ts) | Sitemap with alternates |
| [`src/app/robots.ts`](../../src/app/robots.ts) | robots.txt |
| [`src/app/opengraph-image.tsx`](../../src/app/opengraph-image.tsx) | Default 1200×630 social image |
| [`src/components/seo/json-ld.tsx`](../../src/components/seo/json-ld.tsx) | JSON-LD emitter |
| [`src/content/site.ts`](../../src/content/site.ts) | `siteConfig.url` |

## Tests

There is no dedicated SEO test, and that is a known gap. What covers it today:
`tests/routing.test.ts` guarantees every route exists in both locales with no
duplicate URL, which is the precondition the alternates rely on, and
`npm run build` fails if a page's `generateMetadata` throws. The metadata output
itself is unverified by test — a missing `generateMetadata` on a new page would
not fail the suite.

## Limits and open questions

A sitemap entry is added by hand in `sitemap.ts`. A new static route that nobody
adds there is simply absent from the sitemap, with no test to catch it. Worth
fixing: `sitemap.ts` could derive the static list from `pathnames`, and a test
could assert every `StaticPathname` appears.

Content changes need a rebuild for `lastModified` to move; there is no
revalidation path. `NEXT_PUBLIC_SITE_URL` is build-time only, so a host change
means a rebuild, not an env var edit — it is listed under owner actions in
[../usage.md](../usage.md#before-going-live--owner-actions).
