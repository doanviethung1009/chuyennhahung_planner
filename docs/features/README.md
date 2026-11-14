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
| Admin portal | [admin-portal.md](admin-portal.md) | `/quan-tri` — admin-only user list, create, role change and password reset in the browser (ADR 0010) |
| Admin user filter | [admin-user-filter.md](admin-user-filter.md) | Search (name, handle, email) and role filter on the `/quan-tri` users table, client-side |
| Admin content CMS | [admin-content-cms.md](admin-content-cms.md) | `/quan-tri/noi-dung/...` — editors and admins edit stories, places and reviews with vi and en side by side, publish and moderate (ADR 0011) |
| Public Travel pages from content | [public-travel-cms.md](public-travel-cms.md) | Home, stories, destinations and sitemap read published stories from the content repository, dynamic, so CMS edits go live on the next request (ADR 0012) |
| Header account | [header-account.md](header-account.md) | Sign-in icon for guests, account menu (My Trips, password, admin, sign out) for members, desktop and mobile |
| Create a blank trip | [create-blank-trip.md](create-blank-trip.md) | `/my-trips/new` — create-trip button and form on My Trips, `source: "blank"` |

## Phases not yet open

Not features, and not to be scaffolded early. See
[../architecture.md](../architecture.md#phases).

| Phase | Blocked on |
|---|---|
| Full Planner editor UI | The core API shipped in [travel-planner-core.md](travel-planner-core.md); the clone-and-share flow is in [follow-hung-footsteps.md](follow-hung-footsteps.md), but editing days, activities and expenses in the browser is not built |
| Planner map and AI suggestions | Deliberately deferred by the brief that opened the Planner phase |
| Clickable video cards | Per-video URLs we do not hold |
| Real photography | The owner's photos |
