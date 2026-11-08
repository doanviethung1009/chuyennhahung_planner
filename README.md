# Chuyện Nhà Hưng

> **Đi đâu cũng có chuyện.** — Every road has a story.

A Vietnamese-first travel-storytelling site: personal stories, destinations,
an interactive travel map, day-by-day itineraries, video reviews, and a trip
planning entry point.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Language | TypeScript — `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4, CSS-first `@theme` tokens |
| i18n | `next-intl` 4 — VI default unprefixed, EN at `/en`, localized pathnames |
| Content | Typed seed data in `src/content/**` |
| Tests | Vitest 3 |

## Getting started

```bash
npm install
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (prerenders all 57 pages) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run test` | Vitest — 47 tests |
| `npm run verify:ui` | Screenshots every route at 375 / 768 / 1440 and fails on horizontal overflow |
| `npm run covers` | Regenerates the SVG cover artwork |

### Node version

Requires Node **≥ 20.9**. Two notes about the current `20.14` on this machine:

- `package.json` pins `magic-string` to `^0.30.17` via `overrides`, because
  `@tailwindcss/node` `require()`s it and Node below 20.19 / 22.12 cannot
  `require()` an ES module. **Remove that override once Node is ≥ 20.19.**
- Vitest is held at 3.x for the same reason — Vitest 4/5 need Vite 7/8, which
  require Node ≥ 20.19.

## Documentation

Full documentation lives in [`docs/`](docs/README.md) — every document in English
and Vietnamese (`<name>.vi.md`):

| Document | What it covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) · [vi](docs/architecture.vi.md) | Runtime shape, request path, route map, data contracts, module boundaries, phases |
| [docs/usage.md](docs/usage.md) · [vi](docs/usage.vi.md) | Install, run, test, verify, deploy, and the common extension tasks |
| [docs/features/](docs/features/README.md) · [vi](docs/features/README.vi.md) | One document per feature, with a template for new ones |
| [docs/adr/](docs/adr/README.md) · [vi](docs/adr/README.vi.md) | Architecture decision records, and what requires one |

Every new feature ships a feature document in both languages and a row in the
feature register. `tests/docs.test.ts` enforces it: missing translation, drifted
heading structure, missing section, unregistered document or broken relative link
all fail the suite. The rules are in [`CLAUDE.md`](CLAUDE.md).

## Routing and localization

Vietnamese is the product; English is a translation. VI renders **unprefixed**
(`/chuyen-di-choi`), EN is prefixed (`/en/stories`). Accept-Language detection
is deliberately **off** so a Vietnamese visitor with an English-configured
browser still lands on Vietnamese.

Canonical (internal) pathnames live in [`src/i18n/routing.ts`](src/i18n/routing.ts)
and map 1:1 to the `app/[locale]` folders:

| Internal | Vietnamese | English |
|---|---|---|
| `/` | `/` | `/en` |
| `/stories` | `/chuyen-di-choi` | `/en/stories` |
| `/destinations` | `/kham-pha` | `/en/destinations` |
| `/map` | `/ban-do` | `/en/map` |
| `/itineraries` | `/len-lich-trinh` | `/en/itineraries` |
| `/plan-your-trip` | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |
| `/reviews` | `/goc-review` | `/en/reviews` |
| `/about` | `/ve-nha-hung` | `/en/about` |

Adding a locale means adding it to `routing.ts`, adding `messages/<locale>.json`,
and filling the new key on every `Localized<T>` field in `src/content/**`.
`tests/i18n.test.ts` and `tests/content.test.ts` fail until all three are done.

### Tour routes

**Tours are modelled as itineraries** — an itinerary carries the duration,
indicative price, group size and day-by-day plan a tour would. Legacy tour URLs
are preserved as permanent (308) redirects in
[`next.config.ts`](next.config.ts):

```
/tour, /tours              → /len-lich-trinh
/tour/:slug, /tours/:slug  → /len-lich-trinh/:slug
/en/tour…                  → /en/itineraries…
```

Changing this mapping requires an ADR (see `CLAUDE.md`).

## Design tokens

Every colour, font, radius and shadow is defined once, in the `@theme` block of
[`src/app/globals.css`](src/app/globals.css). Nothing else in the codebase may
hard-code one.

- **Palette** — warm paper and clay: cream/sand surfaces, clay terracotta
  primary, jade accent, ink text.
- **Type** — Lora (display) and Be Vietnam Pro (body), both loaded with the
  `vietnamese` subset so diacritics render correctly.
- **Contrast** — `tests/design-tokens.test.ts` parses the real CSS and asserts
  WCAG AA (4.5:1 text, 3:1 control boundaries). It already caught two failures:
  the primary was lightened past AA for white button text, and control borders
  needed a dedicated `--color-border-strong`.

## Content

Seed content is typed TypeScript in `src/content/`, not a CMS:
8 destinations, 6 stories, 4 itineraries, 6 video reviews — each with a `vi`
and `en` value for every user-visible field.

Cover artwork is generated, on-brand SVG (`npm run covers`) rather than stock
photography, so the site ships with working images and no broken links. Replace
a `cover` field with a real photograph whenever one is available; `CoverImage`
already optimizes raster formats and only bypasses the optimizer for SVG.

### Travel Content System

A separate, writable layer with CRUD APIs for five modules — travel stories,
places, destination collections, reviews and reusable itinerary templates.
It **reuses** the destination and itinerary entities above rather than
duplicating them, and the public pages continue to render the typed seed data.

- Contract and endpoints: [`docs/travel-content-api.md`](docs/travel-content-api.md)
- Why it is built this way: [`docs/adr/0001-travel-content-system.md`](docs/adr/0001-travel-content-system.md)

There is **no database**: entities live behind a store interface with a
JSON-file implementation under `.data/` (gitignored), seeded with demo content
on first use. That is a deliberate, single-process-only choice — see the ADR
before deploying more than one instance.

Admin mutations need `ADMIN_API_TOKEN` (32+ characters) and fail closed without
it. Every monetary field is an integer count of đồng.

## ⚠️ Before going live — owner actions

These are plausible defaults, **not verified**:

1. **Facebook handle** — `src/content/site.ts` assumes `chuyennhahung`.
   Confirm or correct it. (TikTok is set to `@chuyennhahung9495`.)
2. **Contact email** — `hello@chuyennhahung.vn` must exist; the planning page
   links a prefilled `mailto:` to it.
3. **Site URL** — set `NEXT_PUBLIC_SITE_URL`; it drives canonicals, `hreflang`
   and the sitemap. Defaults to `https://chuyennhahung.vn`.
4. **Photography** — swap the generated SVG covers for real photos.
5. **`ADMIN_API_TOKEN`** — generate one (`openssl rand -hex 32`) before the
   Travel Content System admin API can be used at all. Without it every
   `/api/admin/**` route returns 503.
6. **Affiliate links** — every seeded place has an empty `affiliateLinks`
   array. No partner programme is assumed; add real ones or leave it empty.

## Video reviews

Video cards are **presentational only** — no anchor, no play button, no hover
lift. We hold no per-video URLs, so a card that linked to the channel would
imply it opens that specific clip. Visitors reach the clips through the two
channel buttons on the reviews page, which are the links we can guarantee.

To make the cards clickable later, add a URL field to `VideoReview`, wrap the
card body in an anchor, and update `tests/content.test.ts`
(`keeps video reviews link-free`).

## Accessibility

Semantic landmarks, one `<h1>` per page, ordered headings, a skip link,
visible focus rings, ≥44px touch targets, `aria-current` on the active nav
item, and a focus-trapped mobile drawer that closes on Escape and on
navigation.

The travel map is an SVG silhouette with **real HTML anchors** positioned from
true WGS84 coordinates — keyboard-navigable, crawlable, and fully functional
with no client JavaScript.

## Not in this phase

The **AI Planner**. The "Plan your trip" page is a content page with real
contact routes and no server dependency — deliberately no form, because a
submit button with nothing behind it is a dead control.

No **user-trip** entity exists either: the Travel Content System keeps the blog
(stories), the reusable templates and user trips strictly separate, and the
third of those is Planner territory for a later phase.

There is also no **admin UI**. The Travel Content System is an API in this
phase; the admin surface is `curl`, or whatever client the owner prefers.

## Agents

Three specialist agents are defined in `.claude/agents/`, with shared rules in
[`CLAUDE.md`](CLAUDE.md):

| Agent | Owns |
|---|---|
| `system-architect` | Route topology, data contracts, ADRs, diagrams |
| `backend-engineer` | API routes, server actions, persistence, validation |
| `frontend-engineer` | Pages, components, design tokens, i18n catalogues |

Whoever ships a change writes its documentation: the feature document belongs to
the agent that owns the code, `docs/architecture.*` and `docs/adr/**` to the
architect.
