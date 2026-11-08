# Project-specific rules — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

Vietnamese-first travel storytelling site with a trip Planner. These rules are
**project law** and outrank any generic framework guidance, including AIEOS defaults.
Verified stack facts, the module map and the real test list:
`.claude/context/project-context.md`.

## Stack
| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4 — CSS-first `@theme` tokens in `src/app/globals.css` |
| i18n | `next-intl` 4, VI default unprefixed, EN at `/en`, localized pathnames |
| Content | Typed seed data in `src/content/**` |
| Backend | Travel Content System — `src/app/api/**`, `src/server/content/**`, JSON document store in `.data/` |
| Tests | Vitest 3 (Node 20.14 here is below Vite 7's 20.19 floor, so Vitest 4/5 cannot run) |

```bash
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
npm run build      # production build
```

## Brand direction
Personal storytelling crossed with a travel magazine. Warm, romantic, modern, minimal.
Mobile-first — design the 375px view first, then let it breathe at `md` and `lg`. The
tone is a couple telling you about a trip, not a tour operator selling one.

## 1. Vietnamese is the product, English is a translation
VI is the default locale and ships without a prefix (`/chuyen-di-choi`); EN is prefixed
(`/en/stories`). Never ship a user-visible string that is not in **both**
`messages/vi.json` and `messages/en.json`, key-for-key — `tests/i18n.test.ts` enforces
it. Every route must exist in both locales in `src/i18n/routing.ts`. No user-visible
string is hard-coded in a component; everything goes through `next-intl`.

`localeDetection` is **off** deliberately: the audience is ~80% Vietnamese and
`Accept-Language` would hand a Vietnamese visitor with an English-configured phone an
English page. `/` is always Vietnamese.

Fonts must carry the `vietnamese` subset — diacritics must render correctly.

## 2. Tour routes are permanent
Tours are modelled as itineraries. `/tour`, `/tours`, `/tour/:slug`, `/tours/:slug` and
their `/en` equivalents redirect into the itinerary routes via `next.config.ts` (eight
redirects). Removing or repointing them **requires an approved ADR**.

## 3. Design tokens are defined once
In the `@theme` block in `src/app/globals.css`. **No hard-coded colour, font stack,
radius or shadow anywhere else** — `tests/design-tokens.test.ts` enforces this. If you
need a new value, add the token first and tell the user you extended the token set. A
new token is also documented in `docs/features/design-system.*`.

## 4. No placeholder links, no dead buttons
`href="#"` is a defect. Every `href` resolves to a real route or a real external URL;
every button does something. A control that does nothing must not exist — or must link
to a real page that explains the status.

## 5. Accessibility is not optional
Semantic landmarks (`header`/`nav`/`main`/`footer`), one `<h1>` per page, ordered
headings, visible focus rings, labels tied to inputs, real `<button>`/`<a>` elements
(never a `div` with an `onClick`), ≥44px touch targets, and `alt` that carries meaning
(empty `alt=""` only for decoration).

## 6. The Planner backend is a later phase
Until the user opens it, the Planner CTA is a content page with real contact
affordances (mailto, Zalo, Messenger) and **no server dependency**. Do not scaffold
Planner tables, endpoints or queues early, even if it seems helpful. **This rule
overrides the AIEOS "backend first" dependency order.** Opening the phase needs an ADR.

> The **Travel Content System is not the Planner.** It already exists — 26 route
> handlers under `src/app/api/`, a token-guarded admin surface and a public read
> surface, designed in `docs/adr/0001-travel-content-system.md` with its HTTP contract
> in `docs/travel-content-api.md`. Extend it; do not rebuild it, and do not treat its
> existence as permission to start the Planner backend.

## 7. Definition of done
`typecheck`, `lint` and `test` passing *and the output stated*. See
`.claude/rules/01-global-engineering.md` §6.

## 8. Flag missing owner data
Seed content must be realistic and plausible for this brand. Where a value needs the
owner's real data — social handles, phone numbers, booking emails — **flag it
explicitly** instead of leaving a convincing fake in place.

## 9. Every feature ships through a branch and a PR
No direct commits to `main`, no silent local-only work. See
`.claude/rules/05-git-governance.md` — binding on every agent and on the main session.

## 10–12. Documentation is part of done
The architecture and usage documents stay true; every feature ships a feature document;
every document exists in Vietnamese too. `tests/docs.test.ts` enforces all three. Full
contract: `.claude/rules/07-documentation.md`.

## Engineering defaults
- **Server components by default.** `'use client'` needs a stated reason (interactivity,
  browser API) and the client boundary stays as low in the tree as possible.
- **SEO is structural**, not polish: every page needs `generateMetadata`, canonical +
  `hreflang` alternates, and JSON-LD where a schema.org type fits.
- `next/image` with explicit `sizes` for remote images; `next/font` for typefaces.
- **No new runtime dependency** when the platform already covers it. Justify every
  addition by weight and maintenance cost; a new framework, state library, ORM or CSS
  system needs an approved ADR.
- Seed content comes from `src/content/**`. Never inline seed content into a component.
- Persistence stays behind the `ContentStore` interface in
  `src/server/content/store.ts`, so swapping in SQL remains one adapter.
- `ADMIN_API_TOKEN` guards the admin API (min 32 chars, compared with
  `timingSafeEqual`). Never log, echo or commit it. `.data/` is local state, gitignored.
