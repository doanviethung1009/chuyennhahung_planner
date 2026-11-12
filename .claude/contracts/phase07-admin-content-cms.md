# Task Contract: phase07-admin-content-cms — Admin portal, slice 2 (content management in the browser)
- Class: **L** (cross-layer, widens a privilege boundary to the `editor` role; no new dependency, no migration, no new secret). `security` review recommended; `qc` recommended.
- State: **IMPLEMENTED** (ADR 0011 **Accepted** 2026-11-12; docs updated; `qc` / `security` NOT RUN)
- Desired outcome / user impact: an `editor` or `admin` signs in and, at `/quan-tri/noi-dung/...` (EN `/en/admin/content/...`), lists and edits stories, places and reviews (vi and en side by side), publishes / unpublishes / archives stories and moderates reviews, without a token. `curl` + `ADMIN_API_TOKEN` keeps working unchanged.
- Scope IN: `content:write` action; `adminContentRoute`; session opt-in for the routes in the matrix; optional `If-Match: "<updatedAt>"` on content PATCH; `readStaffPageAccess` (editors admitted); shell with role-dependent sections; stories / places / reviews screens; routing entries; messages; docs.
- Scope OUT: create, delete, templates, collections, integrity in the browser; audit log; MFA; rich text; image upload; on-demand revalidation; server actions; any new dependency; SQL change; Planner/trip access.
- Evidence: `src/server/planner/http.ts` (`resolveAdminPrincipal`, `adminSessionLimiter`, `requireSameOrigin`, ~260-390); `src/server/content/http.ts` (`adminRoute`, `parseJsonBody`); `src/server/content/auth.ts`; `src/server/content/repository.ts` (updatedAt writes ~210, 316, 348, 660; status transitions ~335-370); `src/server/content/schemas.ts` (`storyUpdateSchema` 289, `reviewUpdateSchema` 369, `updatedAt` on place/story/review); `src/server/content/errors.ts` (`versionConflict`); `src/server/identity/permissions.ts`; `src/server/planner/admin-page.ts`; `src/app/[locale]/admin/page.tsx`; `src/i18n/routing.ts` (`/admin` at line 32); `src/app/[locale]/stories/[slug]/page.tsx` (`revalidate = 60`, the only revalidate); `docs/travel-content-api.md`.
- Existing contracts to preserve: content API request/response shapes and error envelope for the token path (If-Match optional); `/api/admin/planner/users/**` behaviour; `adminRoute` untouched; tour redirects; VI unprefixed; ADR 0010 guards (same-origin, role per request, `passwordChangeRequired`, 30/min limiter).
- Architecture decision / ADR: `docs/adr/0011-admin-content-cms.md` (Proposed).
- Interface contract:
  - `permissions.ts`: `Action` += `'content:write'`; held by `editor`, `admin`, `service`. `story:publish` unchanged.
  - `src/server/planner/http.ts`: export `resolveAdminPrincipal` (no behaviour change).
  - `src/server/admin/content-route.ts` (new): `adminContentRoute(request, { action: Action; session?: boolean }, handler: (principal: AdminPrincipal) => Promise<NextResponse> | NextResponse): Promise<NextResponse>`. Resolve -> handler -> `toErrorResponse`; always `Cache-Control: no-store`. `content/http.ts` must not import planner or this module.
  - Route matrix (session opt-in; all other travel routes keep `adminRoute`):

    | Route | Method | Action |
    |---|---|---|
    | `stories`, `places`, `reviews` | GET list | `content:write` |
    | `stories/[slug]`, `places/[slug]`, `reviews/[id]` | GET, PATCH | `content:write` |
    | `stories/[slug]/places` | PATCH | `content:write` |
    | `stories/[slug]/status`, `reviews/[id]/status` | POST | `story:publish` |
    | POST create, DELETE, `templates/**`, `collections/**`, `integrity` | | token-only |

  - Concurrency: PATCH reads `If-Match: "<updatedAt>"` (quoted ISO string); the repository compares inside `transact` and throws a `version_conflict` (412 as built; see ADR 0011 implementation notes) whose message names the timestamps; no header -> unchanged behaviour. Repository `updatePlace`, `updateStory`, `updateReview` gain an optional `expectedUpdatedAt`; `updateStoryPlaces` likewise. Responses include `updatedAt` (already do).
  - `src/server/planner/admin-page.ts`: `readStaffPageAccess(): Promise<{status:'anonymous'}|{status:'must-change-password'}|{status:'forbidden'}|{status:'staff'; principal:{kind:'session';userId;handle;role}}>`; `forbidden` = role without `user:provision` and without `content:write`. `readAdminPageAccess` kept.
  - Routing (new keys in `src/i18n/routing.ts`, both locales): `/admin/content/stories` vi `/quan-tri/noi-dung/chuyen-di` en `/admin/content/stories`; `/admin/content/stories/[slug]`; `/admin/content/places` vi `/quan-tri/noi-dung/dia-diem`; `/admin/content/places/[slug]`; `/admin/content/reviews` vi `/quan-tri/noi-dung/danh-gia`. Add to the `returnTo` allow-list. noindex metadata, not in sitemap, `robots.ts` / `X-Robots-Tag` prefixes already cover `/quan-tri` and `/en/admin` (verify they are prefix rules).
  - Pages: server components that read the content repository directly for the initial render (after `readStaffPageAccess`), client forms for edit/status; mutations via same-origin `fetch` to `/api/admin/travel/**`, always sending `If-Match`.
- Tasks by owner:
  - **Architect (this contract):** ADR 0011, README rows, then after implementation `docs/architecture.*` (route table, guard contract, Phase 07 backlog), `docs/usage.*`, `docs/travel-content-api.md`, `.claude/context/project-context.md`.
  - **BE (first):** permissions, `resolveAdminPrincipal` export, `adminContentRoute`, route opt-ins, repository `expectedUpdatedAt`, `readStaffPageAccess`, tests. Also verify and report which public pages cache and for how long (no code change).
  - **FE (after BE merged to the branch):** routing, pages, components, messages, return-to, robots/sitemap checks, tests.
  - **QC / Security:** on demand only.
- File ownership (disjoint):
  - **backend-engineer:** `src/server/identity/permissions.ts`, `src/server/planner/http.ts` (export only), `src/server/planner/admin-page.ts`, `src/server/admin/**`, `src/server/content/repository.ts`, `src/server/content/schemas.ts` (only if an If-Match helper type is needed), `src/server/content/errors.ts` (message helper only), `src/app/api/admin/travel/{stories,places,reviews}/**`, tests: new `tests/admin-content-session.test.ts`, extend `tests/planner-roles.test.ts` (permissions pin), `tests/travel-content-api.test.ts` or the existing content API test (If-Match cases).
  - **frontend-engineer:** `src/i18n/routing.ts`, `src/lib/return-to.ts`, `src/app/[locale]/admin/**` (shell + `content/**` pages), `src/components/admin/**`, `messages/vi.json`, `messages/en.json`, `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts` only if a header rule needs widening, tests `tests/routing.test.ts`, `tests/return-to.test.ts`, `tests/i18n.test.ts`, `tests/client-boundary.test.ts` (add cases only).
  - **Feature document owner:** `frontend-engineer` writes `docs/features/admin-content-cms.md` + `.vi.md`, registered in `docs/features/README.md` and `README.vi.md`, seven sections.
  - No file appears under both engineers. `src/server/planner/admin-page.ts` is BE; the page that calls it is FE.
- Acceptance criteria / tests:
  - Guard matrix for every opted-in route: no credential 401; member session 403; editor session 200; admin session 200; service token 200; user access token in `Authorization` 401; cookie mutation without same-origin 403; `passwordChangeRequired` blocked; 31st mutation in a minute 429; non-opted routes (DELETE, templates, collections, integrity, POST create) reject a session with 401/403 and still accept the token; response `no-store`.
  - `ROLE_ACTIONS` pin: editor has `content:write` and not `user:*`; member has none.
  - If-Match: matching header applies; stale header 412 `version_conflict` and nothing written; absent header unchanged; two concurrent PATCHes with the same stamp -> exactly one succeeds.
  - Status POSTs keep existing `invalid_state` rules (unpublished review blocks story publish; public template blocks archive).
  - Page gate: anonymous -> sign-in with `returnTo`; member -> `notFound()`; editor sees Content only; admin sees Users and Content; editor opening `/quan-tri` Users API gets 403.
  - Routing: every new key exists in vi and en; `tests/docs.test.ts` green; `client-boundary` green; every user-visible string in both message files; one `<h1>` per page, labelled inputs, focus visible, >=44px targets.
  - `npm run typecheck`, `npm run lint`, `npm run test` pass with output stated; `npm run build` run once at the end.
- Security and migration risks: widens a privilege boundary to `editor`; public content editable by a session with no MFA and no audit trail (accepted, ADR 0011 §9); guard shared across two systems; `If-Match` is optional so token callers can still overwrite; no data migration (`updatedAt` already stored); in-memory limiter per process. `security` review recommended (trust-boundary change).
- Rollback approach: remove `session: true` from the content routes (and optionally the pages); `content:write`, the wrapper and the optional `If-Match` are additive and harmless without callers. No data to undo.
- Budget: BE 1 invocation + 1 fix; FE 1 invocation + 1 fix; at most two review/fix cycles if the user calls `qc`/`security`, then escalate. Stop when typecheck, lint and test are green, docs written, and open owner decisions are answered.
- Open questions for the owner: see ADR 0011 "Owner decisions" (six items); also whether a bare editor account should exist before the audit log does.
- Feature document owner (`docs/features/<slug>.md` + `.vi.md`, CLAUDE.md rules 11-12): `frontend-engineer` -> `docs/features/admin-content-cms.md` + `.vi.md`.
- Architecture/usage doc updates needed (rule 10): architect, after the code lands: `docs/architecture.md` + `.vi.md` (routes, guard, Phase 07 backlog), `docs/usage.md` + `.vi.md`, `docs/travel-content-api.md`.
