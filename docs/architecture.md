# Architecture — Chuyện Nhà Hưng

🇻🇳 Bản tiếng Việt: [architecture.vi.md](architecture.vi.md)

A Vietnamese-first travel-storytelling site. Stories, destinations, a travel map,
day-by-day itineraries, video reviews, and a trip-planning entry point. The
Planner *backend* is a later phase; see [Phases](#phases).

## At a glance

| Concern | Choice | Where |
|---|---|---|
| Framework | Next.js 16, App Router, React 19 | [`src/app/`](../src/app) |
| Rendering | Server components, fully prerendered at build | all `page.tsx` |
| Language | TypeScript `strict` + `noUncheckedIndexedAccess` | [`tsconfig.json`](../tsconfig.json) |
| i18n | `next-intl` 4, VI unprefixed, EN at `/en` | [`src/i18n/`](../src/i18n) |
| Styling | Tailwind v4, CSS-first `@theme` tokens | [`src/app/globals.css`](../src/app/globals.css) |
| Content | Typed TypeScript seed data, no CMS | [`src/content/`](../src/content) |
| Tests | Vitest 3 (Node 20.14 blocks Vitest 4/5) | [`tests/`](../tests) |
| Persistence | **None.** No database, no API route, no server action | — |

There is no backend. Every page is a static artefact produced at build time from
typed content in the repository, which is why the whole site survives with no
runtime dependency beyond a file server.

## Request path

```
request
  │
  ├─ next.config.ts redirects ......... legacy /tour, /tours → itinerary routes (308)
  │
  ├─ src/middleware.ts ................ next-intl: locale resolution + localized
  │                                     pathname → internal pathname
  │                                     (skips /api, /_next, /opengraph-image, *.*)
  │
  ├─ src/app/[locale]/layout.tsx ...... fonts, <html lang>, header/main/footer,
  │                                     NextIntlClientProvider
  │
  └─ src/app/[locale]/**/page.tsx ..... server component
         ├─ reads src/content/**       (typed seed data)
         ├─ reads messages/<locale>.json via useTranslations/getTranslations
         ├─ composes src/components/**
         └─ exports generateMetadata → src/lib/metadata.ts
```

Locale-independent routes sit outside `[locale]`: [`robots.ts`](../src/app/robots.ts),
[`sitemap.ts`](../src/app/sitemap.ts) and [`opengraph-image.tsx`](../src/app/opengraph-image.tsx).

## Routing and localization

Vietnamese is the product; English is a translation. VI renders **unprefixed**,
EN is prefixed, and `localeDetection` is **off** on purpose — Accept-Language
would hand a Vietnamese visitor with an English phone an English page.

Canonical (internal) pathnames are English and map 1:1 to the `app/[locale]`
folders. The visible URL per locale is defined once, in
[`src/i18n/routing.ts`](../src/i18n/routing.ts):

| Internal | Vietnamese | English |
|---|---|---|
| `/` | `/` | `/en` |
| `/stories` | `/chuyen-di-choi` | `/en/stories` |
| `/stories/[slug]` | `/chuyen-di-choi/[slug]` | `/en/stories/[slug]` |
| `/destinations` | `/kham-pha` | `/en/destinations` |
| `/destinations/[slug]` | `/kham-pha/[slug]` | `/en/destinations/[slug]` |
| `/map` | `/ban-do` | `/en/map` |
| `/itineraries` | `/len-lich-trinh` | `/en/itineraries` |
| `/itineraries/[slug]` | `/len-lich-trinh/[slug]` | `/en/itineraries/[slug]` |
| `/plan-your-trip` | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |
| `/reviews` | `/goc-review` | `/en/reviews` |
| `/about` | `/ve-nha-hung` | `/en/about` |

Two types keep navigation honest: `AppPathname` is every internal route, and
`StaticPathname` excludes `[slug]` routes so a dynamic route can never be listed
as a plain menu entry in [`nav-items.ts`](../src/components/layout/nav-items.ts).

**Tour routes are permanent.** Tours are modelled as itineraries — an itinerary
carries the duration, indicative price, group size and day plan a tour would.
`/tour`, `/tours`, `/tour/:slug`, `/tours/:slug` and their `/en` equivalents are
308 redirects in [`next.config.ts`](../next.config.ts). Repointing or removing
them requires an approved ADR. Details:
[features/itineraries.md](features/itineraries.md).

Adding a locale means three changes together: `locales` + `pathnames` in
`routing.ts`, a new `messages/<locale>.json`, and the new key on every
`Localized<T>` field in `src/content/**`. `tests/i18n.test.ts` and
`tests/content.test.ts` fail until all three are done.

## Content layer

Content is typed TypeScript, not a CMS. `Localized<T>` is
`Record<Locale, T>`, so the type system — not a review — is what catches a
missing translation.

| Collection | File | Count |
|---|---|---|
| Destinations | [`destinations.ts`](../src/content/destinations.ts) | 8 |
| Stories | [`stories.ts`](../src/content/stories.ts) | 6 |
| Itineraries | [`itineraries.ts`](../src/content/itineraries.ts) | 4 |
| Video reviews | [`video-reviews.ts`](../src/content/video-reviews.ts) | 6 |
| Site + socials | [`site.ts`](../src/content/site.ts) | — |

Shapes live in [`src/content/types.ts`](../src/content/types.ts). Two fields
carry architectural weight: a destination's `coords` are real WGS84 values that
the map projects, and `cover` points at generated on-brand SVG artwork
(`npm run covers`) so the site ships with no broken image.

`site.ts` is flagged **owner action required** — the handles and contact email
are plausible defaults, not verified accounts.

## Module boundaries

The dependency direction is one-way. Nothing below reaches upward.

```
app/[locale]/**      pages: compose, fetch nothing
   ↓
components/**        ui/ · layout/ · cards/ · sections/ · map/ · seo/
   ↓
lib/**               format.ts · map.ts · metadata.ts   (pure functions)
   ↓
content/** · i18n/** · messages/**                      (data + contracts)
```

- `lib/` is pure and side-effect free: date/price/duration formatting, the map
  projection, metadata assembly. It is the layer unit tests target directly.
- `components/ui/` holds primitives (`Button`, `Container`, `Section`, `Badge`,
  `Prose`, `CoverImage`); `sections/` holds page-level compositions; `cards/`
  holds one card per collection. A card never fetches — the page passes it data.
- `src/i18n/navigation.ts` is the only source of `Link`, `getPathname` and
  friends. Importing `next/link` directly would bypass the localized pathname
  map.

## Rendering and the client boundary

Server components by default; `'use client'` needs a stated reason. Today the
client bundle exists for exactly two things: the mobile navigation drawer
(focus trap, Escape, close-on-navigate) in
[`main-nav.tsx`](../src/components/layout/main-nav.tsx), and the locale switcher.

The travel map is deliberately **not** a client component: an SVG silhouette
with real `<a>` anchors positioned by [`lib/map.ts`](../src/lib/map.ts), so it is
keyboard-navigable and crawlable with JavaScript disabled.

## SEO

SEO is structural here, not a polish pass.
[`src/lib/metadata.ts`](../src/lib/metadata.ts) builds every page's canonical URL
plus the full `hreflang` set, with `x-default` pointing at Vietnamese. Each page
exports `generateMetadata`; JSON-LD is emitted through
[`components/seo/json-ld.tsx`](../src/components/seo/json-ld.tsx) where a
schema.org type fits. `sitemap.ts` enumerates every route in every locale.
Details: [features/seo-and-metadata.md](features/seo-and-metadata.md).

## Design tokens

Every colour, font, radius, shadow and easing is defined once, in the `@theme`
block of [`globals.css`](../src/app/globals.css). Nothing else may hard-code one.
`tests/design-tokens.test.ts` parses the real CSS and asserts WCAG AA contrast —
it is the reason the interactive primary is `clay-600` rather than `clay-500`,
and the reason `--color-border-strong` exists. Details:
[features/design-system.md](features/design-system.md).

## Verification

| Gate | Command | What it protects |
|---|---|---|
| Types | `npm run typecheck` | `Localized<T>` completeness, route-type safety |
| Lint | `npm run lint` | `eslint-config-next` rules |
| Tests | `npm run test` | content, i18n parity, routing, map, tokens, docs |
| Build | `npm run build` | every page prerenders |
| UI | `npm run verify:ui` | screenshots at 375/768/1440, fails on overflow |

## Phases

Deliberately absent, and not to be scaffolded early:

- **Planner backend.** `/plan-your-trip` is a content page with real contact
  routes (mailto, Zalo, Messenger) and no form — a submit button with nothing
  behind it is a dead control. Opening this phase means a database, validation,
  rate limiting and an ADR, in that order.
- **Clickable video cards.** We hold no per-video URLs, so cards are
  presentational. Making them clickable means adding a URL field to
  `VideoReview` and updating `tests/content.test.ts`.
- **Real photography.** Covers are generated SVG until the owner supplies photos.

## Ownership

| Agent | Owns |
|---|---|
| `system-architect` | Route topology, data contracts, ADRs, `docs/architecture.*`, diagrams |
| `backend-engineer` | `src/app/api/**`, server actions, persistence, validation |
| `frontend-engineer` | Pages, components, tokens, `messages/*.json` |

Whoever ships a feature writes its document in [`features/`](features/README.md),
in both languages. Rules: [`CLAUDE.md`](../CLAUDE.md).
