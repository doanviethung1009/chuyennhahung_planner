# Architecture Decision Records

🇻🇳 Bản tiếng Việt: [README.vi.md](README.vi.md)

One file per decision, `NNNN-slug.md`, numbered in the order they were taken and
never renumbered. Owned by `system-architect`. Each ADR exists in both languages;
new ones start from [`_template.md`](_template.md) / [`_template.vi.md`](_template.vi.md).

An ADR is required — not optional — for:

- removing or repointing the permanent tour redirects in `next.config.ts`
- changing the route topology or the localized pathname map
- opening the Planner backend phase (data model and submission contract first) — done in [0002](0002-planner-core.md); a *further* phase, such as the Planner UI or AI suggestions, needs its own
- adding a framework, state library, ORM or CSS system, or a major upgrade of one that validates external input — see [0003](0003-zod-4.md)
- turning on Accept-Language locale detection
- replacing the typed seed content with a CMS or database

Write the decision first, then draw it if a picture helps — as a Mermaid block
inside the ADR itself, in both language twins. A diagram visualizes a decision;
it does not make one.

The decisions the site already rests on — and did not need a record of their own — are
described in [../architecture.md](../architecture.md); anything that *changes* one needs an
ADR here.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-travel-content-system.md) | Travel Content System: typed entities behind a store interface, no database yet, `zod` validation, fail-closed admin auth | Accepted |
| [0002](0002-planner-core.md) | Planner core: four normalised trip collections, a real trip owner with object-level authorization, independent template clones, integer-VND budgeting with a BigInt boundary, `If-Match` concurrency | Accepted |
| [0003](0003-zod-4.md) | Upgrade `zod` to 4.x to remove GHSA-mrhx-c7xc-m3w5 rather than fence it behind the request body cap; two deprecated call sites migrated, behaviour verified unchanged | Accepted |
| [0004](0004-planner-identity.md) | Planner identity: an `HttpOnly` session cookie exchanged for the existing access token, behind one `resolveIdentity` seam, with CSRF as the explicit cost | Accepted |
| [0005](0005-trip-sharing-and-story-cloning.md) | Trip sharing and story cloning: unguessable capability share links with a read-only sanitised projection, planning status separate from lifecycle, server-derived attribution, in-memory rate limiting | Accepted |
| [0006](0006-unified-identity-and-roles.md) | Unified identity and roles: `role` on the one user model, a pure `can(identity, action, resource)`, `ADMIN_API_TOKEN` demoted to a service principal that never reaches a browser, templates and trips kept apart | Accepted (steps 1–2 implemented; 3–4 Phase 07) |
| [0007](0007-password-and-google-sign-in.md) | Password and Google sign-in: operator-created accounts sign in with an email and scrypt-hashed password; Google sign-in (hand-written OIDC + PKCE) links an existing account by email or creates a member account on first sign-in; both issue the ADR 0004 session | Accepted |
| [0008](0008-postgres-document-store.md) | PostgreSQL as the shared document store: each JSON document becomes one JSONB row with a row-locked `transact`, revision-validated read cache and Postgres rate limits, so the app can run as several instances; normalised tables stay step 2 | Accepted |
| [0009](0009-postgres-persistence.md) | Planner on normalised PostgreSQL tables (ADR 0008's step 2, taken directly for the Planner): the store's `transact` runs under an advisory lock, loads, and writes only the changed rows; `pg` with plain-SQL migrations and no ORM; no fallback to JSON when a database is configured | Accepted |
| [0010](0010-admin-portal-session-authorization.md) | Admin portal: the existing user-admin handlers accept the service token or a cookie session whose role passes `can()`; role read per request, shorter admin session lifetimes, same-origin on every mutation, repository-level last-admin and self-change guards, 404 for non-admin pages, one-time secrets in `no-store` responses | Accepted |
| [0011](0011-admin-content-cms.md) | Admin content CMS: stories, places and review moderation in the browser through a session-capable `adminContentRoute` reusing the planner principal resolver, one new `content:write` action, editors admitted to `/quan-tri`, `If-Match: updatedAt` concurrency (required since CORE-11), create/delete/templates left token-only | Accepted |
| [0012](0012-public-travel-from-content-repository.md) | Public Travel pages read the content repository: one server-only `getPublicContent` read module with a `static` rollback adapter, published-only with 404 otherwise, fully dynamic rendering instead of revalidation, no DB needed at build, idempotent never-overwrite seeding of the 6 static stories, two additive story fields | Accepted |
| [0013](0013-content-on-postgres-tables.md) | Travel Content on normalised PostgreSQL tables: one table per collection behind the unchanged repository, one table engine shared with the Planner, typed columns plus JSONB for structure, `CONTENT_DATABASE_URL` with no fallback, no foreign keys yet, seeding under a lock, import/export scripts | Accepted |
| [0014](0014-community-trips-and-reviews.md) | Community trips and place reviews: a separate opt-in `listing` state with staff pre-moderation, a `CommunityTripCard` allow-list projection, traveller reviews as a Planner-store entity (one per author per place, rate-limited, plain text), a `community:moderate` action, delivered in two PRs | Accepted (implemented) |
| [0015](0015-community-review-author-controls.md) | Staff controls over review authors: an in-app staff question with a temporary `held` status instead of email, and reversible `ReviewRestriction` rows that block new writes and hide existing reviews for one place or a whole Planner account, a time-boxed guest-key variant, a new `community:restrict` action | Accepted (PR 1 and PR 2 implemented) |
| [0016](0016-auto-deploy-dev.md) | Automatic deploy of `main` to the dev VM: green CI on `main` builds the dev image on GitHub into GHCR, a self-hosted runner on the VM pulls it, probes `/api/health` and rolls back on failure; one image per environment, rollback restores the image not the schema | Accepted (run end to end on the dev VM, 2026-11-15) |
| [0017](0017-super-admin-role.md) | Super admin role: `super_admin` holds `runbook:read` alone (Runbook is 404 for admin/editor), an admin acts only on member/editor accounts (create, re-role, reset password), the last super admin is protected, ban plus soft and hard delete of staff accounts, first one promoted with the service token | Accepted (implemented in two PRs) |
| [0018](0018-handle-sign-in.md) | Sign in with an email or an account handle (`identifier`), generic 401 and rate limits unchanged; password reset no longer needs an email | Accepted |
| [0019](0019-community-foundation.md) | Community foundation (phase C1): one pure moderation state machine over the existing listing flow, an append-only `ModerationEvent` log written in the same transaction, and a PostgreSQL-backed shared limiter for write paths (fixed window, fails closed); `Trip.origin`, reports and profiles deferred to their first consumer | Accepted |
| [0020](0020-admin-workspace-shell.md) | Admin Workspace shell: one admin `layout.tsx` with a role-aware grouped sidebar, `/admin` becomes a dashboard and the user console moves to `/admin/users`, additive routes for collections, integrity, audit and system, one new action `audit:read`, no new store or auth path | Accepted |
| [0021](0021-personalized-home.md) | Personalized home page: one public, cookie-free document for everyone; personal content filled in the browser from a new allow-listed `GET /api/planner/home` projection; rule-based ranking in the browser over a public pool; no new route | Proposed |
| [0022](0022-home-mvp-server-session.md) | Home MVP reads the session cookie on the server for `/` only (first-trip and Continue Planning bands), guest page byte-identical, `private, no-store` for cookie requests; supersedes ADR 0020 for the MVP | Accepted |
| [0023](0023-admin-root-layout.md) | Admin Workspace gets its own root layout (route group `(admin)`), top bar and shared `AdminPageHeader`; the public header and footer are not rendered in admin; shared fonts module; refines ADR 0020 | Accepted |
| [0024](0024-guest-identity-privacy.md) | Guest identity and privacy (D4): the guest key becomes an HMAC-SHA256 with a server secret (also for the limiter key), a guest identifier is cleared after 30 days, guest restrictions last at most 30 days, existing keys are cleared by migration; the Privacy Policy text and guest deletion are separate owner/staff tasks | Accepted |
| [0025](0025-member-profiles-and-use-this-trip.md) | Member profiles and "Use this trip" (Phase 11): `member_profiles` 1:1, private by default, opt-in public slug page behind `profilePublicOpen`; a per-trip `allowCopy` switch inside `listing` (default off, Terms Article 3); copy built from the public projection with an allow-list, `Trip.origin` text attribution, no republishing of copies yet; migrations `0015`/`0016` | Proposed |
| [0026](0026-public-places-routes.md) | Public Places routes: `/dia-diem/[slug]` (VI) and `/places/[slug]` (EN); a place has no publish state so every catalogue place is public; read through an allow-list projection, read-only reviews, listed on the destination page | Accepted |
| [0027](0027-component-test-stack.md) | Component test stack: `jsdom` + Testing Library as dev dependencies, opt-in per file with `// @vitest-environment jsdom`; Vitest default stays `node`; real messages and the real `api()` over a `fetch` stub | Accepted |
| [0028](0028-content-delete-action.md) | `content:delete`: a new action to permanently delete a place, held by admin, super admin and the service token (not editor); `DELETE places/[slug]` accepts a session on it; the UI button comes from the server-side check and the API enforces it again | Accepted |
