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
| Itineraries | [itineraries.md](itineraries.md) | `/len-lich-trinh` plus the permanent tour redirects |
| Video reviews | [video-reviews.md](video-reviews.md) | `/goc-review` — deliberately link-free cards, channel buttons |
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
| Auto deploy to dev | [auto-deploy-dev.md](auto-deploy-dev.md) | `deploy-dev` workflow: green `main` builds an image, the VM's self-hosted runner deploys it, health probe and rollback (ADR 0016) |
| Community reviews | [community-reviews.md](community-reviews.md) | Traveller place reviews: Planner-written ones are moderated, home-page guest ones go live and staff can remove them; self-reported, plain text (ADR 0014, PR 2) |
| Community trips | [community-trips.md](community-trips.md) | Public trips shown on the home page and `/community-trips` after owner opt-in and staff approval; any edit re-queues; author by name or anonymous (ADR 0014, PR 1) |
| Moderation events | [moderation-events.md](moderation-events.md) | Append-only audit log of every community action (listing, review, restriction), written in the same transaction; staff read route; 1-year retention; includes the moderation state machine (ADR 0019) |
| Community reports | [community-reports.md](community-reports.md) | Readers (guest or member) report a public community trip or review; staff dismiss or mark actioned in the admin queue, one audit event per resolve (batch 10.5) |
| Creator Terms | [creator-terms.md](creator-terms.md) | Members accept the current Creator Terms version before a listing request or Planner review is accepted; recorded per version, logged; reads and withdrawals never blocked (ADR 0019 §4) |
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

## Phases not yet open

Not features, and not to be scaffolded early. See
[../architecture.md](../architecture.md#phases).

| Phase | Blocked on |
|---|---|
| Planner map and AI suggestions | Deliberately deferred by the brief that opened the Planner phase |
| Clickable video cards | Per-video URLs we do not hold |
| Real photography | The owner's photos |
