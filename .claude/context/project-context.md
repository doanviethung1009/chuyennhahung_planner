# Project context — Chuyện Nhà Hưng

Real repository facts, so agents read instead of guessing. Verified against `main`
(23bf7d9) on 2026-11-08. **Update this file when any of it changes.**

This is agent working memory, not product documentation. The product documentation
lives in `docs/` and is bilingual and test-enforced — see CLAUDE.md "Documentation".

| Field | Value |
|---|---|
| Project name | Chuyện Nhà Hưng — "Đi đâu cũng có chuyện" |
| What it is | Vietnamese-first travel storytelling site with a trip Planner |
| Framework | Next.js `^16.4.5`, App Router, React `^19.2.0` |
| Language | TypeScript `^5.9.3`, `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS `^4.3.5` — CSS-first `@theme` tokens in `src/app/globals.css` |
| i18n | `next-intl` `^4.14.9`, localized pathnames, `localePrefix: 'as-needed'` |
| Package manager | npm (`package-lock.json`) |
| Node | v20.14.0 locally |
| Python 3 | 3.13.7 — **required** for the `PreToolUse` git guard hook |
| Tests | Vitest `^3.2.7` — Node 20.14 is below Vite 7's 20.19 floor, so Vitest 4/5 **cannot** run here |
| Deployment / CI | **No `.github/` workflows.** Branch protection is convention + a local hook only |

## Commands (the real ones — do not invent others)
```bash
npm run dev        # next dev
npm run build      # next build
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
npm run verify:ui  # node scripts/screenshots.mjs (puppeteer-core)
npm run covers     # node scripts/generate-covers.mjs
```

## Locales and routes
- Locales `['vi','en']`, default `vi`, **unprefixed**; English at `/en`.
- `localeDetection: false` — deliberate: `/` is always Vietnamese.
- Canonical pathnames are English and map 1:1 to `src/app/[locale]/**`; the
  visitor-facing VI/EN URLs live in `pathnames` in `src/i18n/routing.ts`.
- **Tour routes are permanent** (CLAUDE.md rule 2): eight redirects in `next.config.ts`
  map `/tour`, `/tours`, `/tour/:slug`, `/tours/:slug` and their `/en` equivalents into
  the itinerary routes. Removing or repointing them requires an approved ADR.

## Backend — the Travel Content System (this exists; do not re-scaffold it)
26 route handlers under `src/app/api/`: a token-guarded admin surface at
`api/admin/travel/**` (places, stories, collections, reviews, templates, integrity)
and a public read surface at `api/travel/**`. Designed in
`docs/adr/0001-travel-content-system.md`; the HTTP contract is `docs/travel-content-api.md`.

| Module | Role |
|---|---|
| `src/server/content/auth.ts` | Bearer `ADMIN_API_TOKEN`, min 32 chars, `timingSafeEqual`. **No user table — the token is the principal.** |
| `src/server/content/store.ts` | Persistence behind a two-method `ContentStore`: the whole content set as one JSON document on disk. Swapping in SQL is a new adapter and nothing else. |
| `src/server/content/repository.ts` | Domain operations over the store |
| `src/server/content/schemas.ts` | Validation schemas for every entity |
| `src/server/content/http.ts`, `errors.ts` | Request/response shapes and the error taxonomy |
| `src/server/content/instance.ts` | Composition root |
| `src/content/travel/seed.ts` | Seed data for the system |

The on-disk store lives in `.data/` and is **gitignored** — it is local state, not
content you may commit.

> **The Planner backend is still a separate, unopened phase** (CLAUDE.md rule 6).
> The Travel Content System is not the Planner. Do not scaffold Planner tables,
> endpoints or queues until the user opens that phase.

## Other critical modules
| Path | Role |
|---|---|
| `src/i18n/routing.ts` | Locales, localized pathname map, routing config |
| `src/i18n/request.ts`, `navigation.ts` | next-intl request config and typed navigation |
| `next.config.ts` | Tour redirects, image remote patterns |
| `src/content/types.ts` | Data contracts for the seed content |
| `src/app/globals.css` | `@theme` design tokens — the only place they may be defined |
| `src/lib/metadata.ts`, `map.ts`, `format.ts` | Metadata/SEO helpers, map geometry, formatting |
| `src/components/**` | `cards/`, `layout/`, `sections/`, `seo/`, `ui/`, `map/` |

## Tests and what they enforce
`tests/i18n.test.ts` (VI/EN catalogue parity) · `tests/docs.test.ts` (**bilingual docs
contract** — twin, mirrored headings, single h1, translation link, index registration,
resolving links) · `tests/design-tokens.test.ts` · `tests/routing.test.ts` ·
`tests/content.test.ts` · `tests/map.test.ts` · `tests/travel-content-{api,auth,schemas,
repository,acceptance}.test.ts` (+ `travel-content-helpers.ts`).

## Sensitive data and regulated boundaries
`ADMIN_API_TOKEN` guards the admin API — never log it, echo it or commit it. `.env*`
reads are denied in `.claude/settings.json`. No end-user accounts, no payments, no PII
store. The `.data/` JSON store holds content, not personal data.

**Owner data still needed** (do not invent plausible-looking values): real social
handles, phone numbers and booking email.

## Branch / PR conventions
`<type>/<short-kebab-summary>`; Conventional Commits ≤72 chars; draft PR right after
the first push; `main` only ever moves through a merged PR. Detail in
`.claude/rules/05-git-governance.md`.
