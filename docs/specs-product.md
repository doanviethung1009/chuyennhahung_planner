# Spec — product and capabilities

🇻🇳 Bản tiếng Việt: [specs-product.vi.md](specs-product.vi.md)

What Chuyện Nhà Hưng is for, who uses it, what it offers today and which rules every
change must respect. The timeline and what is still open are in
[specs-roadmap.md](specs-roadmap.md); how it is built is in
[architecture.md](architecture.md).

## Purpose

A Vietnamese-first travel-storytelling site — tagline "Đi đâu cũng có chuyện" — with a
trip Planner. Vietnamese is the product and English is a translation. A reader should
be able to read a story, find the place on the map, copy the itinerary into their own
trip, budget it and share it.

## Who uses it

| Audience | Gets | Credential |
|---|---|---|
| Visitor | Stories, destinations, map, itineraries, video reviews, community trips, guest place reviews | None |
| Member (traveller) | The above plus My Trips, the trip editor, share links, own reviews | Cookie session: password, Google, or operator-issued access token |
| Editor | Edit and publish stories, places and reviews in the admin portal | Session with the `editor` role |
| Admin | Everything an editor does, plus user administration and community moderation; manages `member` and `editor` accounts only | Session with the `admin` role |
| Super admin | Everything an admin does, plus the in-browser Runbook and management of admin accounts | Session with the `super_admin` role |
| Service principal | Automation against the admin APIs; never reaches a browser | `ADMIN_API_TOKEN` |

Roles live on the one user model and are checked by a pure `can(identity, action,
resource)`; see [features/admin-roles.md](features/admin-roles.md) and
[features/super-admin-accounts.md](features/super-admin-accounts.md).

## Capabilities

| Area | What it does | Routes (Vietnamese) | Status | Document |
|---|---|---|---|---|
| Stories | Storytelling index and detail | `/chuyen-di-choi` | Shipped | [features/stories.md](features/stories.md) |
| Destinations | Places, cross-linked to stories | `/kham-pha` | Shipped | [features/destinations.md](features/destinations.md) |
| Travel map | SVG map with real coordinates, no client JavaScript | `/ban-do` | Shipped | [features/travel-map.md](features/travel-map.md) |
| Itineraries | Day plans; legacy tour URLs redirect here | `/len-lich-trinh` | Shipped | [features/itineraries.md](features/itineraries.md) |
| Video reviews | Presentational cards and channel buttons | `/goc-review` | Shipped | [features/video-reviews.md](features/video-reviews.md) |
| Plan your trip | Contact-only page, no form by design | `/thiet-ke-chuyen-di` | Shipped, not wired to the Planner | [features/plan-your-trip.md](features/plan-your-trip.md) |
| Sign-in | Password and Google | `/dang-nhap` | Shipped | [features/follow-hung-footsteps.md](features/follow-hung-footsteps.md) |
| My Trips and editor | Create, edit and budget trips; clone a story | `/chuyen-di-cua-toi` | Shipped | [features/trip-editor.md](features/trip-editor.md) |
| Share links | Read-only view with projected budget overrun | `/chia-se/[token]` | Shipped | [features/shared-budget-overrun.md](features/shared-budget-overrun.md) |
| Community | Public trips and traveller reviews, moderated | `/chuyen-di-cong-dong` | Shipped | [features/community-trips.md](features/community-trips.md) |
| Admin portal | Users, roles, content and moderation | `/quan-tri` | In progress (Phase 07) | [features/admin-portal.md](features/admin-portal.md) |
| Runbook tab | Operations guides inside the browser | `/quan-tri/runbook` | Shipped, super admin only | [features/admin-runbook.md](features/admin-runbook.md) |

Planner map and AI suggestions are not offered; see
[specs-roadmap.md](specs-roadmap.md#not-open-yet).

## API surfaces

| Surface | Prefix | Who calls it | Contract |
|---|---|---|---|
| Travel Content | `/api/travel` | Service principal | [travel-content-api.md](travel-content-api.md) |
| Planner | `/api/planner` | Signed-in traveller | [features/travel-planner-core.md](features/travel-planner-core.md) |
| Admin | `/api/admin` | Staff session or service principal | [runbook.md](runbook.md) lists every endpoint |
| Community | `/api/community` | Visitors and members | [features/community-trips.md](features/community-trips.md) |
| Shared trip | `/api/shared` | Anyone holding the link | [features/follow-hung-footsteps.md](features/follow-hung-footsteps.md) |
| Health | `/api/health` | Operators and probes | [runbook-api.md](runbook-api.md) |

## Rules every change keeps

1. VI and EN both, from the same message keys; no user-visible string in only one.
2. Tour routes stay permanent redirects.
3. Design tokens are defined once, in `@theme` in `src/app/globals.css`.
4. No placeholder link and no dead button.
5. Accessibility: landmarks, one `<h1>`, ordered headings, visible focus, targets of at
   least 44px, meaningful `alt`.
6. A change ships through a branch and a PR, with `typecheck`, `lint` and `test`
   passing and their output stated.
7. Docs are corrected in the same change, in both languages.

## Data and persistence

| Store | Holds | PostgreSQL variable | Without it |
|---|---|---|---|
| Planner | Users, sessions, trips, days, activities, expenses, reviews | `PLANNER_DATABASE_URL` | JSON file, local development only |
| Travel Content | Stories, places, reviews, templates | `CONTENT_DATABASE_URL` | JSON file, local development only |

Destinations, itineraries and video reviews are typed TypeScript in `src/content/`.
Running, migrating and backing up the stores is in [usage.md](usage.md) and
[deploy-database.md](deploy-database.md).
