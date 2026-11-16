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
| Validation | `zod` `^4.6.7` — on the trust boundary for both API surfaces. Use `z.iso.*` and `z.ZodType`; the 3.x spellings (`z.string().datetime()`, `z.ZodTypeAny`) are deprecated. See `docs/adr/0003-zod-4.md` |
| Package manager | npm 11 (`package-lock.json`). Install scripts are an allowlist: `allowScripts` in `package.json`, pinned to `pkg@version`, so a version bump of an approved package needs re-approval. Review before approving — it is a supply-chain boundary |
| Node | **24.22.2 LTS**, pinned in `.nvmrc` — the single source for local `nvm use` and CI's `node-version-file`. `engines.node` is `>=24` |
| Python 3 | 3.13.7 — **required** for the `PreToolUse` git guard hook and `tests/git-guard.test.ts` |
| Tests | Vitest `^3.2.7`. Node 24 now permits Vitest 4/5 (they need Vite 7/8 and Node ≥ 20.19); **not yet upgraded** — that is the path to the remaining dev-only advisories |
| CI | `.github/workflows/ci.yml` — typecheck, lint, test, build on every PR into `main`. **Advisory only:** required checks need branch protection, unavailable while the repo is private on GitHub Free |
| Local git guards | `.githooks/pre-commit` + `pre-push` refuse commits/pushes that move `main`; opt in per clone with `git config core.hooksPath .githooks` |
| Deployment | `.github/workflows/deploy-dev.yml` deploys green `main` to the dev VM via a self-hosted runner (ADR 0016; not yet run end to end). `NEXT_PUBLIC_SITE_URL` must be set at **build** time |

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
| `src/server/content/store.ts` | Persistence behind `ContentStore` (`read`, `write`, `transact`): the whole content set as one JSON document on disk. Swapping in SQL is a new adapter and nothing else. |
| `src/server/content/repository.ts` | Domain operations over the store |
| `src/server/content/schemas.ts` | Validation schemas for every entity |
| `src/server/content/http.ts`, `errors.ts` | Request/response shapes and the error taxonomy |
| `src/server/content/instance.ts` | Composition root |
| `src/content/travel/seed.ts` | Seed data for the system |

The on-disk store lives in `.data/` and is **gitignored** — it is local state, not
content you may commit.

## Backend — the Planner (the phase is open; this exists too)
The owner opened the Planner backend phase and it shipped: `src/app/api/planner/**`
(traveller-facing) and `src/app/api/admin/planner/**` (provisioning), over
`src/server/planner/**`. Designed in `docs/adr/0002-planner-core.md`.

| Module | Role |
|---|---|
| `src/server/planner/auth.ts` | **A principal per traveller**: a `plannerUsers` row holding a SHA-256 digest of a 48-byte token, returned once at provisioning. Every trip carries an `ownerId` and every read and write is filtered by it. |
| `src/server/planner/password.ts`, `google.ts`, `google-http.ts` | ADR 0007: scrypt passwords (temporary password → forced change), Google OIDC + PKCE (`/api/planner/oauth/google/{start,callback}`), match by `googleSub` → email match refused (`link_required`) → create; linking only explicit from a session (`start?intent=link`). Global caps: 500 live OAuth attempts, 30 signups/h, scrypt 4 active/32 waiting. Env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_SIGNUP_ENABLED`, `GOOGLE_REDIRECT_URI`; routes 404 when unset |
| `src/server/identity/permissions.ts` | ADR 0006 steps 1–2: pure `Role`, `Action`, static `ROLE_ACTIONS`, `can`, `userRole` (absent → `member`). `can` gates every admin route and page; `super_admin` and `canManageRole` per ADR 0017. `PlannerIdentity.role` and the public user's `role` are resolved from it; `PATCH /api/admin/planner/users/[userId]` (admin token, strict `{ role }`) sets it |
| `src/server/planner/repository.ts` | Trips, days, activities, expenses; `identify(request)` throws 401 without a valid token |
| `src/server/planner/schemas.ts` | Validation schemas for trip input |
| `src/server/planner/budget.ts`, `money.ts` | Target budget vs estimated/actual cost; integer-safe money |
| `src/server/planner/http.ts` | Planner HTTP boundary — reuses the content error envelope, adds `ETag`/`If-Match` optimistic concurrency |
| `src/server/planner/catalog.ts`, `store.ts` | Place catalog access and persistence |
| `src/server/admin/content-route.ts` | ADR 0011: `adminContentRoute` (session-capable guard for `api/admin/travel/**`, resolver reused from `planner/http.ts`, always `no-store`) and `ifMatchStamp` (optional `If-Match` -> 412 `version_conflict`). Action `content:write` = editor/admin/service. `readStaffPageAccess` in `planner/admin-page.ts`. Pages: `src/app/[locale]/admin/content/**` (5 localized routes). Public Travel pages (`/`, `/stories`, `/stories/[slug]`, `/destinations/[slug]`, sitemap) read the repository through `src/server/content/public.ts` `getPublicContent()` (ADR 0012; `PUBLIC_CONTENT_SOURCE=static` rolls back; `npm run content:seed-static`); they are `force-dynamic`, must not import repository/store (`tests/client-boundary.test.ts`); stories block renderer `src/components/story/story-blocks.tsx`; `src/content/stories.ts` is now seed source/static adapter/fixture |
| `src/server/runbook/docs.ts`, `src/components/runbook/markdown.tsx`, `src/app/[locale]/admin/runbook/page.tsx` | Admin-only Runbook tab (`user:provision`, others 404): allow-listed `docs/*.md` rendered to React elements; `docs/runbook.md` lists every route handler and `tests/runbook.test.ts` keeps it in sync; Dockerfile copies `docs/` |
| `src/server/rate-limit.ts` | In-memory sliding-window limiter (`createRateLimiter`, `clientKey`, `shareReadLimiter` 60/min, `signInLimiter` 10/min, `checkShareRead(headers)` for the share page). Per-process, spoofable key — ADR 0005 |
| `PlannerRepository` sharing methods | `duplicateTrip`, `setVisibility`, `rotateShareToken`, `revokeShare`, `getSharedTrip(token): SharedTripView \| null` (allow-list projection), `describeSession`; catalog gains `getLinkedStory` (ADR 0005) |
| `src/app/api/planner/[id]/{duplicate,share,share/rotate}`, `GET /api/planner/session`, `GET /api/shared/[token]` | Duplicate, share lifecycle, session probe, public read-only view (GET only, identical 404s, `rate_limited` 429 + `Retry-After`) |
| Community trips (ADR 0014, PR 1) | `Trip.listing` (`null` or pending/approved/rejected), repository `requestListing`/`withdrawListing`/`decideListing`/`listListingQueue`/`listCommunityTrips`, action `community:moderate`, routes `api/planner/[id]/listing`, `api/community/trips`, `api/admin/community/**`, read module `src/server/community/public.ts`, migration `0005_trip_listing.sql`. Any trip mutation re-queues an approved listing in `touch`. Closed until `contribution` in `src/content/site.ts` is filled by the owner. Place reviews (PR 2): `CommunityReview` in the Planner store / table `community_reviews` (migration `0006`), `source` planner (moderated) or homepage (live at once, staff can only remove), routes `api/planner/reviews/**`, `api/community/reviews`, `api/admin/community/reviews/**`, limiters in `rate-limit.ts`, same `contribution` gate. ADR 0015: review status `held` (staff question, migration `0007`), `ReviewRestriction` table `review_restrictions` (migration `0008`), action `community:restrict` (admin/service), routes `api/admin/community/restrictions/**`. ADR 0019 (Accepted): `src/server/community/submission.ts` (pure state machine, batch 10.1) and `events.ts` (`appendEvent`, batch 10.2): `AuditEvent` table `audit_events` (migration `0010`), key `auditEvents`, one event per community action in the same transaction, 1-year sweep, staff route `GET api/admin/community/events?targetId=` |
| `src/server/persistence/json-store.ts` | Shared JSON document store (memory + file); `DocumentStore.transact` |
| `src/server/persistence/postgres-planner-store.ts`, `planner-rows.ts`, `postgres-pool.ts`, `migrate.ts`, `planner-transfer.ts` | ADR 0008/0009: the Planner's PostgreSQL store. Selected in `planner/instance.ts` **only when `PLANNER_DATABASE_URL` is set** (never falls back to the file); unset → `.data/planner.json`. Migrations in `db/migrations/*.sql` run at startup (`npm run db:migrate` by hand); `planner:import` / `planner:export` move data. See `docs/features/planner-postgres-persistence.md`. ADR 0013: Travel Content uses the same engine (`content-rows.ts`, `postgres-content-store.ts`, `content-transfer.ts`) when **`CONTENT_DATABASE_URL`** is set — tables `content_*` from `db/migrations/0004_content.sql`, no FKs between content entities, `content:import` / `content:export`, seed under a lock; unset → JSON file (`TRAVEL_CONTENT_STORE`) |

> **Two systems, one vocabulary — do not conflate them.** Travel Content is editorial
> data owned by the brand with a single `ADMIN_API_TOKEN` principal; the Planner is
> traveller-owned trip data with a principal per traveller. They share the error
> envelope and `parseJsonBody` from `src/server/content/http.ts`.

> **Trip editor shipped** (`src/components/planner/trip-editor/**`, `docs/features/trip-editor.md`):
> header, days, activities and expenses are editable on `/my-trips/[id]` over the
> existing API, every write with `If-Match`. **Still absent, and not to be
> scaffolded without an ADR:** the Planner map (`/plan-your-trip` is still the
> contact-only content page), AI suggestions, a hosted identity provider / Auth.js, MFA, and foreign keys between content entities (both stores can already run on PostgreSQL, ADR 0009 / 0013). See
> `docs/architecture.md#phases`.

## Other critical modules
| Path | Role |
|---|---|
| `src/server/planner/home-page.ts`, `src/lib/home/continue-trip.ts`, `src/components/home/home-member-band.tsx` | ADR 0022: the **only** server-side session read outside admin pages — `readHomeMember()` on `/` gives a member band (first-trip / next-trip / Continue Planning); guest page unchanged; layout, header and metadata stay cookie-free (`tests/home-page-boundary.test.ts`) |
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
repository,acceptance}.test.ts` (+ `travel-content-helpers.ts`) · `tests/json-store.test.ts`
(store cache) · `tests/planner-password.test.ts`, `tests/planner-google.test.ts` (ADR 0007 sign-in) · `tests/planner-roles.test.ts` (ADR 0006 roles, `can` matrix, PATCH) · `tests/security-headers.test.ts` (site-wide headers) · `tests/admin-content-session.test.ts` (ADR 0011 route/action matrix, `If-Match` 412).

## Sensitive data and regulated boundaries
`ADMIN_API_TOKEN` guards the admin API — never log it, echo it or commit it. `.env*`
reads are denied in `.claude/settings.json`. **End-user accounts exist (ADR 0007)**:
`.data/planner.json` holds emails and names (personal data, including customers who
signed up with Google), scrypt password hashes and Google subject ids next to token
and session digests — never log, return or commit them. `GOOGLE_CLIENT_SECRET` is a
server secret like `ADMIN_API_TOKEN`. No payments. The content store holds content,
not personal data.

**Owner data still needed** (do not invent plausible-looking values): real social
handles, phone numbers and booking email.

## Branch / PR conventions
`<type>/<short-kebab-summary>`; Conventional Commits ≤72 chars; draft PR right after
the first push; `main` only ever moves through a merged PR. Detail in
`.claude/rules/05-git-governance.md`.
