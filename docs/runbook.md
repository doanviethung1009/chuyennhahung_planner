# Runbook — overview and API list

🇻🇳 Bản tiếng Việt: [runbook.vi.md](runbook.vi.md)

The one place to start when operating the app: which guide answers which
question, the day-to-day checks, and the list of every HTTP endpoint. The same
text is shown to administrators in the browser at `/quan-tri/runbook`
(`/en/admin/runbook`), see [features/admin-runbook.md](features/admin-runbook.md).

## Which guide to open

| You want to | Open |
|---|---|
| Bring up a blank VM to a running, auto-deployed app | [deploy-runbook.md](deploy-runbook.md) |
| Check, restart, back up, restore, rotate a secret, handle an incident | [deploy-operations.md](deploy-operations.md) |
| Move the JSON data to PostgreSQL on its own VM | [deploy-database.md](deploy-database.md) |
| Install or repair the self-hosted deploy runner | [deploy-runner.md](deploy-runner.md) |
| Call, check and troubleshoot the deployed APIs | [runbook-api.md](runbook-api.md) |
| Turn on and operate Google sign-in on the dev VM | [runbook-google-sign-in.md](runbook-google-sign-in.md) |
| Understand how the app is built: routes, data flow, modules, phases | [architecture.md](architecture.md) |
| Install, run, test and deploy, and the day-to-day workflows | [usage.md](usage.md) |
| Read the Travel Content API contract and error codes | [travel-content-api.md](travel-content-api.md) |

## Quick checks

- Liveness: `GET /api/health` returns `{"status":"ok"}`. It touches no store, so a database outage shows as Planner `503`s, not as a failed health check.
- Admin pages are for the `admin` role (and the service principal). Anyone else, including editors, gets a plain `404`.
- Secrets (`ADMIN_API_TOKEN`, `GOOGLE_CLIENT_SECRET`, database URLs) never appear in this document or in the browser tab.

## Who may call what

The **Who may call** column of the table below uses these terms:

- **Public**: no credential. Where noted, rate-limited per process.
- **Traveller**: the `planner_session` cookie from sign-in, or the traveller's access token. Every read and write is filtered to that traveller's own data. Cookie writes must be same-origin.
- **Admin token**: `Authorization: Bearer $ADMIN_API_TOKEN`.
- **Admin / staff session**: the browser session of a user whose role allows the named action; the admin token also works. Roles and actions: [features/admin-roles.md](features/admin-roles.md).

## API list

This table is the reference (what exists, who may call it); how to call, check and troubleshoot the APIs on the dev VM is in [runbook-api.md](runbook-api.md).

Paths use the literal bracket form of the route files under `src/app/api/`.
`tests/runbook.test.ts` fails when this table and the route files disagree, so
adding or removing a route means editing this table in both languages.

| Method | Path | Who may call | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness probe for the container healthcheck |
| GET | `/api/travel/places` | Public | List published places |
| GET | `/api/travel/places/[slug]` | Public | One place |
| GET | `/api/travel/stories` | Public | List published stories |
| GET | `/api/travel/stories/[slug]` | Public | One story |
| GET | `/api/travel/collections` | Public | List collections |
| GET | `/api/travel/collections/[slug]` | Public | One collection |
| GET | `/api/travel/reviews` | Public | List published reviews |
| GET | `/api/travel/templates` | Public | List trip templates |
| GET | `/api/travel/templates/[slug]` | Public | One trip template |
| GET | `/api/shared/[token]` | Public, rate-limited | Read-only shared trip by share token |
| GET | `/api/community/trips` | Public, rate-limited | Approved community trips |
| GET | `/api/community/reviews` | Public, rate-limited | Live community reviews |
| POST | `/api/community/reviews` | Public, rate-limited | Guest review from the home page (live at once) |
| POST | `/api/planner/session` | Public, rate-limited | Sign in (token or email + password), opens the session cookie |
| GET | `/api/planner/session` | Traveller (session cookie or access token) | Who am I (session probe) |
| DELETE | `/api/planner/session` | Traveller (session cookie or access token) | Sign out |
| POST | `/api/planner/password` | Traveller (session cookie or access token) | Change own password |
| DELETE | `/api/planner/google` | Traveller (session cookie or access token) | Unlink own Google account (needs a password set; rate-limited) |
| GET | `/api/planner/oauth/google/start` | Public, rate-limited | Begin Google sign-in (404 when unset) |
| GET | `/api/planner/oauth/google/callback` | Public | Google sign-in callback (404 when unset) |
| GET | `/api/planner` | Traveller (session cookie or access token) | List own trips |
| POST | `/api/planner` | Traveller (session cookie or access token) | Create a trip (blank or from a template) |
| GET | `/api/planner/[id]` | Traveller (session cookie or access token) | One trip, with ETag |
| PATCH | `/api/planner/[id]` | Traveller (session cookie or access token) | Edit the trip header (If-Match) |
| DELETE | `/api/planner/[id]` | Traveller (session cookie or access token) | Archive the trip |
| POST | `/api/planner/[id]/restore` | Traveller (session cookie or access token) | Restore an archived trip |
| POST | `/api/planner/[id]/duplicate` | Traveller (session cookie or access token) | Duplicate the trip |
| GET | `/api/planner/[id]/budget` | Traveller (session cookie or access token) | Budget: target vs estimated vs actual |
| PATCH | `/api/planner/[id]/days/[dayNumber]` | Traveller (session cookie or access token) | Edit a day |
| PATCH | `/api/planner/[id]/reorder` | Traveller (session cookie or access token) | Reorder or move activities between days |
| POST | `/api/planner/[id]/activities` | Traveller (session cookie or access token) | Add an activity |
| PATCH | `/api/planner/[id]/activities/[activityId]` | Traveller (session cookie or access token) | Edit an activity |
| DELETE | `/api/planner/[id]/activities/[activityId]` | Traveller (session cookie or access token) | Delete an activity |
| POST | `/api/planner/[id]/expenses` | Traveller (session cookie or access token) | Add an expense |
| PATCH | `/api/planner/[id]/expenses/[expenseId]` | Traveller (session cookie or access token) | Edit an expense |
| DELETE | `/api/planner/[id]/expenses/[expenseId]` | Traveller (session cookie or access token) | Delete an expense |
| PUT | `/api/planner/[id]/share` | Traveller (session cookie or access token) | Turn sharing on (create share token) |
| DELETE | `/api/planner/[id]/share` | Traveller (session cookie or access token) | Revoke sharing |
| POST | `/api/planner/[id]/share/rotate` | Traveller (session cookie or access token) | Rotate the share token |
| PUT | `/api/planner/[id]/listing` | Traveller (session cookie or access token) | Request a community listing |
| DELETE | `/api/planner/[id]/listing` | Traveller (session cookie or access token) | Withdraw the listing |
| GET | `/api/planner/reviews` | Traveller (session cookie or access token) | Own place reviews |
| PUT | `/api/planner/reviews/[placeSlug]` | Traveller (session cookie or access token) | Write or replace own review (moderated) |
| DELETE | `/api/planner/reviews/[placeSlug]` | Traveller (session cookie or access token) | Delete own review |
| GET | `/api/admin/planner/users` | Admin token or admin session | List users (`user:provision`) |
| POST | `/api/admin/planner/users` | Admin token or admin session | Create a user, returns a one-time secret (`user:provision`) |
| PATCH | `/api/admin/planner/users/[userId]` | Admin token or admin session | Set the role (`user:promote`) |
| DELETE | `/api/admin/planner/users/[userId]` | Admin token or admin session | Delete a user: `?mode=soft` disables and marks deleted (restorable), `?mode=hard` (default) removes for good; a session may hard-delete only a soft-deleted account (ADR 0017) |
| POST | `/api/admin/planner/users/[userId]/ban` | Admin token or admin session | Ban an account: ends its sessions, blocks every sign-in (ADR 0017) |
| POST | `/api/admin/planner/users/[userId]/unban` | Admin token or admin session | Lift a ban |
| POST | `/api/admin/planner/users/[userId]/restore` | Admin token or admin session | Restore a soft-deleted account |
| GET | `/api/admin/planner/users/[userId]/impact` | Admin token or admin session | Count the trips and reviews a permanent delete would remove |
| POST | `/api/admin/planner/users/[userId]/reset-password` | Admin token or admin session | Reissue a temporary password (`user:provision`) |
| POST | `/api/admin/planner/users/[userId]/rotate-token` | Admin token only | Rotate the access token |
| DELETE | `/api/admin/planner/users/[userId]/google` | Admin token only | Unlink Google from the user |
| GET | `/api/admin/planner/integrity` | Admin token only | Planner store integrity report |
| GET | `/api/admin/overview` | Admin token or staff session | Dashboard card counts, filtered by role (`content:write`) |
| GET | `/api/admin/community/queue` | Admin token or admin session | Listing queue, pending first (`community:moderate`) |
| PATCH | `/api/admin/community/trips/[id]` | Admin token or admin session | Approve or reject a listing (`community:moderate`) |
| GET | `/api/admin/community/reviews` | Admin token or admin session | Review moderation queue (`community:moderate`) |
| PATCH | `/api/admin/community/reviews/[id]` | Admin token or admin session | Approve, reject, hold or remove a review (`community:moderate`) |
| GET | `/api/planner/terms` | Traveller (session cookie or access token) | Current Creator Terms status |
| POST | `/api/planner/terms` | Traveller (session cookie or access token) | Accept the current Creator Terms version (idempotent) |
| GET | `/api/admin/community/events` | Admin token or admin session | Audit log for one `?targetId=` (`community:moderate`) |
| GET | `/api/admin/community/restrictions` | Admin token or admin session | List review restrictions (`community:restrict`) |
| POST | `/api/admin/community/restrictions` | Admin token or admin session | Restrict a person (`community:restrict`) |
| DELETE | `/api/admin/community/restrictions/[id]` | Admin token or admin session | Lift a restriction (`community:restrict`) |
| GET | `/api/admin/travel/places` | Admin token or staff session | List places (all statuses) |
| POST | `/api/admin/travel/places` | Admin token or staff session | Create a place |
| GET | `/api/admin/travel/places/[slug]` | Admin token or staff session | One place |
| PATCH | `/api/admin/travel/places/[slug]` | Admin token or staff session | Edit a place (optional If-Match) |
| DELETE | `/api/admin/travel/places/[slug]` | Admin token or staff session | Delete a place |
| GET | `/api/admin/travel/stories` | Admin token or staff session | List stories (all statuses) |
| POST | `/api/admin/travel/stories` | Admin token or staff session | Create a story |
| GET | `/api/admin/travel/stories/[slug]` | Admin token or staff session | One story |
| PATCH | `/api/admin/travel/stories/[slug]` | Admin token or staff session | Edit a story (optional If-Match) |
| DELETE | `/api/admin/travel/stories/[slug]` | Admin token or staff session | Delete a story |
| POST | `/api/admin/travel/stories/[slug]/status` | Admin token or staff session | Change story status |
| GET | `/api/admin/travel/reviews` | Admin token or staff session | List reviews (all statuses) |
| POST | `/api/admin/travel/reviews` | Admin token or staff session | Create a review |
| GET | `/api/admin/travel/reviews/[id]` | Admin token or staff session | One review |
| PATCH | `/api/admin/travel/reviews/[id]` | Admin token or staff session | Edit a review (optional If-Match) |
| DELETE | `/api/admin/travel/reviews/[id]` | Admin token or staff session | Delete a review |
| POST | `/api/admin/travel/reviews/[id]/status` | Admin token or staff session | Change review status |
| PATCH | `/api/admin/travel/stories/[slug]/places` | Admin token or staff session | Set the places a story links to |
| GET | `/api/admin/travel/collections` | Admin token only | List collections |
| POST | `/api/admin/travel/collections` | Admin token only | Create a collection |
| GET | `/api/admin/travel/collections/[slug]` | Admin token only | One collection |
| PATCH | `/api/admin/travel/collections/[slug]` | Admin token only | Edit a collection |
| DELETE | `/api/admin/travel/collections/[slug]` | Admin token only | Delete a collection |
| GET | `/api/admin/travel/templates` | Admin token only | List templates |
| POST | `/api/admin/travel/templates` | Admin token only | Create a template |
| GET | `/api/admin/travel/templates/[slug]` | Admin token only | One template |
| PATCH | `/api/admin/travel/templates/[slug]` | Admin token only | Edit a template |
| DELETE | `/api/admin/travel/templates/[slug]` | Admin token only | Delete a template |
| POST | `/api/admin/travel/collections/[slug]/status` | Admin token only | Change collection status |
| POST | `/api/admin/travel/templates/[slug]/reorder` | Admin token only | Reorder template activities |
| POST | `/api/admin/travel/templates/[slug]/move-activity` | Admin token only | Move a template activity between days |
| GET | `/api/admin/travel/integrity` | Admin token only | Content integrity report |

## Conventions

- Errors share one envelope with a stable `code`; the codes are listed in [travel-content-api.md](travel-content-api.md).
- Planner writes use optimistic concurrency: send the `ETag` from the read back as `If-Match`; a mismatch is `412 version_conflict`.
- `429 rate_limited` carries `Retry-After`. Limits are per process and the client key is spoofable ([ADR 0005](adr/0005-trip-sharing-and-story-cloning.md)).
- Admin responses are `no-store`.
