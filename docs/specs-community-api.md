# Community Platform spec — API

🇻🇳 Bản tiếng Việt: [specs-community-api.vi.md](specs-community-api.vi.md)

Status: **Proposed**. Labels **[C] [P] [A]**: see
[specs-community-overview.md](specs-community-overview.md). No route is built by this
document; existing routes live in `src/app/api/community`, `src/app/api/admin/community`
and `src/app/api/planner`.

## Goals and scope

The HTTP contract for the Community Platform: routes, who may call them, pagination, the
error vocabulary and limits. Request and response bodies are validated with zod 4 on the
trust boundary, as every current surface is. [C]

## Requirements

- **API1** Reuse the existing error envelope and `parseJsonBody`
  (`src/server/content/{errors,http}.ts`). Existing codes: `bad_request`,
  `payload_too_large`, `validation_failed`, `unauthorized`, `forbidden`,
  `password_change_required`, `not_found`, `slug_conflict`, `invalid_reference`,
  `invalid_state`, `precondition_required`, `version_conflict`, `rate_limited`,
  `service_unavailable`. New codes are added only when none fits. [C]
- **API2** Three surfaces, matching today's prefixes: public reads `/api/community`,
  signed-in actions `/api/planner` and `/api/media`, staff `/api/admin/community`. [C]
- **API3** Every mutation by a browser session is same-origin checked and returns
  `Cache-Control: no-store`; staff routes always `no-store`. [C] (ADR 0010/0011)
- **API4** Editable documents use `ETag`/`If-Match`; a missing header is
  `precondition_required`, a stale one `version_conflict`. [C] (ADR 0002)
- **API5** A non-owner sees `404 not_found`, never `403`, for someone else's private
  resource, so ids cannot be probed. [C] (ADR 0005)
- **API6** Public lists use cursor pagination: `?limit` (default 20, max 50) and an opaque
  `?cursor`; the body is `{ items, nextCursor }`. No offset. [P]
- **API7** Public reads return allow-list projections only (never `authorId` for
  anonymous content, never email or `ownerId`). [C] (ADR 0014)

## Design

### Public reads (no sign-in)

| Method and path | Purpose | Status |
|---|---|---|
| `GET /api/community/trips` | Gallery; adds filters `destination`, `durationMax`, `style`, `partySize`, `sort` | [C] route, [P] filters |
| `GET /api/community/reviews` | Place reviews | [C] existing |
| `GET /api/community/journals` | Published journals; filters `kind`, `placeSlug`, `tag`, `author`, `lang` | [P] |
| `GET /api/community/journals/[slug]` | One published journal | [P] |
| `GET /api/community/profiles/[slug]` | Public profile and its published items | [P] |
| `GET /api/community/search?q=` | Full-text over published items, `kind` filter | [P] |
| `GET /api/community/[kind]/[id]/comments` | Visible comments, cursor paged | [P] |

### Signed-in actions

| Method and path | Purpose | Notes |
|---|---|---|
| `PUT/DELETE /api/planner/[id]/listing` | Request or withdraw publication | [C] existing |
| `POST /api/community/trips/[token]/use` | Clone into a private draft | Returns `TripView`; copy quota |
| `GET/POST /api/planner/journals` | List mine / create draft | |
| `GET/PATCH/DELETE /api/planner/journals/[id]` | Read, edit (`If-Match`), delete | Owner only |
| `POST /api/planner/journals/[id]/{submit,unpublish,archive}` | State transitions by the author | `invalid_state` if not allowed |
| `POST /api/media/uploads` | Create an upload intent | Validates declared MIME, size, quota |
| `POST /api/media/uploads/[id]/complete` | Finish; server verifies and processes | |
| `DELETE /api/media/[id]` | Remove own asset | |
| `GET/PATCH /api/planner/profile` | Own profile and visibility | |
| `PUT/DELETE /api/community/follows/[slug]` | Follow, unfollow | Idempotent |
| `PUT/DELETE /api/community/[kind]/[id]/{like,save}` | Like, save | Idempotent |
| `POST /api/community/[kind]/[id]/comments` | Comment | Published targets only |
| `DELETE /api/community/comments/[id]` | Delete own comment | |
| `POST /api/community/reports` | Report content | Fixed reason list |
| `GET /api/planner/notifications`, `POST …/read` | Bell | Polled |

### Staff

| Method and path | Purpose | Action required |
|---|---|---|
| `GET /api/admin/community/queue?kind=&status=` | Pending, reported, held | `community:moderate` |
| `POST /api/admin/community/{kind}/[id]/decision` | `{ decision, reason? }`: approve, reject, request_changes, unpublish, remove, restore | `community:moderate` (`restore` needs `community:restrict`, [P]) |
| `GET /api/admin/community/reports`, `POST …/[id]/resolve` | Handle reports | `community:moderate` |
| `GET /api/admin/community/events?targetId=` | Moderation log | `community:moderate` |
| `…/restrictions` | Existing user restrictions, extended to journals, comments, cloning | `community:restrict` |

### Authorization summary

| Caller | May |
|---|---|
| Anonymous | Public reads; guest review per ADR 0014 |
| Member | Own drafts and trips; submit, like, save, follow, comment, report, use a trip |
| Editor | Moderate (today's `community:moderate`) |
| Admin / super admin | Moderate, restrict users |
| Service principal | Staff routes only; never acts as an author |

## Flows and failure states

| Situation | Response |
|---|---|
| No session on a signed-in route | `401 unauthorized` |
| Banned or restricted user writes | `403 forbidden` with the existing restriction message |
| Gate closed (`contributionOpen` false) | `503 service_unavailable` on community writes; reads unaffected |
| Journal not in a state that allows the action | `409` via `invalid_state` |
| Stale edit | `412 version_conflict` |
| Too many writes | `429 rate_limited` with `Retry-After` |
| Body over limit (journal 200 KB JSON, comment 1000 chars) | `413 payload_too_large` / `422 validation_failed` |
| Unknown or non-owned id | `404 not_found` |
| Media not `ready` at submit | `422 validation_failed` naming the asset |

Rate limits (proposed, per user unless stated): comments 10/hour, follows 60/hour, likes
120/hour, reports 10/day, trip copies 10/day, uploads 30/day and 200 MB total pending,
journal submits 5/day. Anonymous: 60 reads/min per client key, as `shareReadLimiter`.

## Dependencies and security

Needs the shared rate-limit store (decision D8 in
[architecture](specs-community-architecture.md)) before the write routes ship; the
current per-process limiter is spoofable (ADR 0005). Details in
[security](specs-community-security.md).

## Test scenarios

Route × caller matrix (anonymous, member, owner, other member, editor, admin, service,
banned) with expected status; pagination stability under inserts; idempotent PUT/DELETE;
`If-Match` paths; anonymous author absent from every body; gate-closed behaviour.

## Open questions

| # | Question | Recommended |
|---|---|---|
| 1 | One generic `/{kind}/[id]/…` segment or a route per kind? | Generic, validated against an enum |
| 2 | Should comments need a verified email once an email sender exists? | Later; not now |
