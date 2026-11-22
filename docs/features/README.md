# Features — register

🇻🇳 Bản tiếng Việt: [README.vi.md](README.vi.md)

Every feature in the app has one document here, in both languages. **A feature
that is not in this table is not finished** — `tests/docs.test.ts` fails on a
document that is not registered, and on a registered document whose Vietnamese
twin is missing.

New features start from [`_template.md`](_template.md) /
[`_template.vi.md`](_template.vi.md).

| Feature | Document | What it covers |
|---|---|---|
| i18n and routing | [i18n-and-routing.md](i18n-and-routing.md) | Locales, localized pathnames, middleware, message catalogues |
| Stories | [stories.md](stories.md) | `/chuyen-di-choi` index and detail, the storytelling core |
| Destinations | [destinations.md](destinations.md) | `/kham-pha` index and detail, the cross-reference hub |
| Travel map | [travel-map.md](travel-map.md) | `/ban-do` — SVG silhouette, real coordinates, no JS |
| Member map | [member-map.md](member-map.md) | `/chuyen-di-cua-toi` (My Trips, ADR 0031) — a signed-in member's private map: solid dots visited, hollow dots planned (ADR 0029) |
| Itineraries | [itineraries.md](itineraries.md) | `/len-lich-trinh` plus the permanent tour redirects |
| Video reviews | [video-reviews.md](video-reviews.md) | `/goc-review` — deliberately link-free cards, channel buttons |
| Vietnam provinces | [vietnam-provinces.md](vietnam-provinces.md) | Reference list of the 34 first-level units (2025 merger) with the 63 former units; data only, no UI |
| Plan your trip | [plan-your-trip.md](plan-your-trip.md) | `/thiet-ke-chuyen-di` — Planner entry point, no form by design |
| Design system | [design-system.md](design-system.md) | `@theme` tokens, primitives, contrast tests |
| SEO and metadata | [seo-and-metadata.md](seo-and-metadata.md) | Canonicals, `hreflang`, sitemap, JSON-LD |
| Follow Hưng's footsteps | [follow-hung-footsteps.md](follow-hung-footsteps.md) | Story itinerary, trip setup, sign-in, My Trips, read-only share links |
| Travel Planner core | [travel-planner-core.md](travel-planner-core.md) | `/api/planner` — trips, days, activities, expenses, budget, template clone |
| Planner on PostgreSQL | [planner-postgres-persistence.md](planner-postgres-persistence.md) | `PLANNER_DATABASE_URL` store, advisory-lock transaction, migrations, import and export |
| Travel Content on PostgreSQL | [content-postgres-tables.md](content-postgres-tables.md) | `CONTENT_DATABASE_URL` store, one table per collection on the shared table engine, seeding under a lock, import and export |
| Admin roles | [admin-roles.md](admin-roles.md) | `role` on the user, `permissions.ts`, `PATCH /api/admin/planner/users/[userId]` to promote the first admin |
| Admin shell | [admin-shell.md](admin-shell.md) | One layout for every admin page: grouped role-aware sidebar, breadcrumb, skip link, phone menu; `/admin` overview and the user console at `/admin/users` (ADR 0020) |
| Admin dashboard | [admin-dashboard.md](admin-dashboard.md) | `/admin` cards per role: pending listings and reviews, story/review drafts, accounts, runtime; `GET /api/admin/overview` (P07-11) |
| Admin portal | [admin-portal.md](admin-portal.md) | `/quan-tri` — admin-only user list, create, role change and password reset in the browser (ADR 0010) |
| Admin user filter | [admin-user-filter.md](admin-user-filter.md) | Search (name, handle, email) and role filter on the `/quan-tri` users table, client-side |
| Admin place delete | [admin-place-delete.md](admin-place-delete.md) | "Delete place" on `/admin/content/places/[slug]` for admin and super admin only; `content:delete`, confirm dialog, 409 `place_in_use` with counts (CORE-10) |
| Auto deploy to dev | [auto-deploy-dev.md](auto-deploy-dev.md) | `deploy-dev` workflow: green `main` builds an image, the VM's self-hosted runner deploys it, health probe and rollback (ADR 0016) |
| Community reviews | [community-reviews.md](community-reviews.md) | Traveller place reviews: Planner-written ones are moderated, home-page guest ones go live and staff can remove them; self-reported, plain text (ADR 0014, PR 2) |
| More destinations | [more-destinations.md](more-destinations.md) | Eight destinations we have not visited yet (objective text only), landmark places for them and for four older destinations, `content:seed-places` top-up |
| Trip template list | [trip-template-list.md](trip-template-list.md) | Public list at `/lich-trinh-mau` (`/en/trip-templates`) of templates whose visibility is public, text-only cards leading to `/trip-setup/[template]` (WEB-2, P04-4) |
| Public places | [places.md](places.md) | Place pages at `/dia-diem/[slug]` (`/en/places/[slug]`) and a Places section on each destination; every catalogue place is public; read-only reviews (ADR 0026) |
| Community trips | [community-trips.md](community-trips.md) | Public trips shown on the home page and `/community-trips` after owner opt-in and staff approval; any edit re-queues; author by name or anonymous (ADR 0014, PR 1) |
| Moderation events | [moderation-events.md](moderation-events.md) | Append-only audit log of every community action (listing, review, restriction), written in the same transaction; staff read route; 1-year retention; includes the moderation state machine (ADR 0019) |
| Community reports | [community-reports.md](community-reports.md) | Readers (guest or member) report a public community trip or review; staff dismiss or mark actioned in the admin queue, one audit event per resolve (batch 10.5) |
| Creator Terms | [creator-terms.md](creator-terms.md) | Members accept the current Creator Terms version before a listing request or Planner review is accepted; recorded per version, logged; reads and withdrawals never blocked (ADR 0019 §4) |
| Member map sharing | [member-map-sharing.md](member-map-sharing.md) | Slice 2a of ADR 0030: a member turns on, rotates or revokes a share link for their visited-places map; token shown once, digest stored, anonymous by default; store, owner API, public page and the controls with a preview of the public map on `/my-map` |
| Shared write limiter | [shared-write-limiter.md](shared-write-limiter.md) | Review write limits (5/h per user, 10/h per guest) counted in PostgreSQL so restarts and instances share them; database down → 503, review not written (ADR 0019 §3) |
| Trip editor | [trip-editor.md](trip-editor.md) | Edit a trip on `/my-trips/[id]`: header, days, activities (add, edit, delete, reorder, move), expenses; every write sends `If-Match` |
| Shared budget overrun | [shared-budget-overrun.md](shared-budget-overrun.md) | Shared and owner trip pages show the projected total, the overrun and each person's extra share |
| Admin content CMS | [admin-content-cms.md](admin-content-cms.md) | `/quan-tri/noi-dung/...` — editors and admins edit stories, places and reviews with vi and en side by side, publish and moderate (ADR 0011) |
| Public Travel pages from content | [public-travel-cms.md](public-travel-cms.md) | Home, stories, destinations and sitemap read published stories from the content repository, dynamic, so CMS edits go live on the next request (ADR 0012) |
| Header account | [header-account.md](header-account.md) | Sign-in icon for guests, account menu (My Trips, password, admin, sign out) for members, desktop and mobile |
| Home Continue Planning | [home-continue-planning.md](home-continue-planning.md) | A band above the hero for signed-in members: create the first trip, or Continue Planning on the next unfinished trip; guests see the page unchanged |
| Create a blank trip | [create-blank-trip.md](create-blank-trip.md) | `/my-trips/new` — create-trip button and form on My Trips, `source: "blank"` |
| Docker deploy on one VM | [docker-deploy.md](docker-deploy.md) | Runbook: nginx + app + optional PostgreSQL, bind-mounted state, host setup, backup |
| Super admin accounts | [super-admin-accounts.md](super-admin-accounts.md) | `super_admin` role (ADR 0017): only it opens the Runbook, admins cannot manage admin accounts |
| Handle sign-in | [handle-sign-in.md](handle-sign-in.md) | Sign in with an email or account handle; reset password works without an email (ADR 0018) |
| Admin runbook | [admin-runbook.md](admin-runbook.md) | `/quan-tri/runbook` — super-admin-only tab that shows the API list and the operations guides from `docs/` in the browser |
| Admin audit viewer | [admin-audit-viewer.md](admin-audit-viewer.md) | `/admin/audit` — filterable, paged read of the audit log; role, account and story-status acts now write events; `GET /api/admin/audit`, action `audit:read` (P07-13) |
| Admin system status | [admin-system-status.md](admin-system-status.md) | `/admin/system` — super-admin read-only page: store mode, last migration, build, integration flags, health, backups "not configured"; `GET /api/admin/system`, action `runbook:read` (P07-17) |
| Admin users and roles | [admin-users-roles.md](admin-users-roles.md) | `/admin/users/roles` read-only role matrix; unlink Google and rotate token from the user console; `limit`/`cursor`/`sort` on `GET /api/admin/planner/users` (P07-12) |
| Admin collections and integrity | [admin-content-collections.md](admin-content-collections.md) | `/quan-tri/noi-dung/bo-suu-tap` and `/toan-ven` — editors edit collections (`If-Match`, publish status) and read the content integrity report; admins also the Planner report (P07-15) |
| Admin itinerary templates | [admin-content-templates.md](admin-content-templates.md) | `/quan-tri/noi-dung/lich-trinh-mau` — editors edit templates, reorder and move activities (`If-Match`), read the frozen source snapshot; create and delete stay token-only (P07-6) |
| Admin moderation workspace | [admin-moderation-workspace.md](admin-moderation-workspace.md) | `/admin/community` triage workspace: counts and jump links, fixed section order, empty states, shared item layout, read-only item history (P07-14) |

## Phases not yet open

Not features, and not to be scaffolded early. See
[../architecture.md](../architecture.md#phases).

| Phase | Blocked on |
|---|---|
| Trip route map (pins and routes inside a trip) and AI suggestions | Deliberately deferred by the brief that opened the Planner phase |
| Clickable video cards | Per-video URLs we do not hold |
| Real photography | The owner's photos |
