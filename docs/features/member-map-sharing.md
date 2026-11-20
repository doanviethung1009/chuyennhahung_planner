# Feature — Member map sharing (store, owner API and public page)

🇻🇳 Bản tiếng Việt: [member-map-sharing.vi.md](member-map-sharing.vi.md)

## Summary

A signed-in member can switch on a share link for their own map of visited places, rotate it, or revoke it. This is **slice 2a** of ADR [0030](../adr/0030-member-map-sharing.md): the store, the migration and the owner API only. Slice **2b** adds the public page `/shared-map/[token]` (below). There are still **no controls on `/my-map`** (slice 2c): until it ships, a link can only be issued through the API. Sharing is off and anonymous by default; the token is shown once and only its SHA-256 digest is stored.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `GET /api/planner/map/share` | same | same |
| `PUT /api/planner/map/share` | same | same |
| `DELETE /api/planner/map/share` | same | same |
| `POST /api/planner/map/share/rotate` | same | same |

API routes are not localised. The controls (2c) are not part of this slice.

| Internal | Vietnamese | English |
|---|---|---|
| `/shared-map/[token]` | `/ban-do-chia-se/[token]` | `/en/shared-map/[token]` |

The public page is a **page only**: there is no public JSON endpoint.

## Data

- Table `member_map_shares` (migration `0016`, rollback in `db/rollback/`, JSON key `memberMapShares`): `user_id` (unique), `token_digest` (SHA-256 hex, unique, nullable — null means not shared), `share_name` (`anonymous` | `name`), `created_at`, `updated_at`. No foreign key (ADR 0013). A missing row reads as "not shared, anonymous".
- The token is 43 base64url characters from `randomBytes(32)` (`SHARE_TOKEN_PATTERN`). It is returned once by the response that issues it and never stored.
- Public types `PublicMemberMap { displayName: string | null; points }` and `PublicMemberMapPoint { slug; visitsBucket: 1 | 2 | 3 }`, separate from any private map type. Buckets: 1 trip → 1, 2–3 → 2, 4 or more → 3.
- Audit actions on `targetKind: 'user'`: `map_share_on`, `map_share_off`, `map_share_rotate`, `map_share_name`. No token and no name in any row.
- Rate limits: share changes use their own bucket, 20 per hour per member (`WRITE_LIMITS.memberMapShare`); the public read bucket (`memberMapReadLimiter`, 60 per minute per client) is defined for slice 2b and is separate from trip sharing.

## How it works

The principal is the session's user; no user id or slug is read from a body or path. `plannerRoute` enforces the cookie same-origin rule. Bodies are strict Zod schemas.

- `GET` returns `{ enabled, shareName, visitedPlaces, sparse }`, never the token. `sparse` is true under 2 visited places: a warning for the later preview, not a block.
- `PUT { enabled, shareName }` is idempotent. Enabling a map that has a token keeps it and returns no token; enabling one without issues a token and returns it once. `shareName: 'name'` is refused with `403 share_name_unavailable` until the profile gate of ADR 0025 (`profilePublicOpen`) exists, and with `422 display_name_unsuitable` when the display name contains `@` or has 7 or more digits (the second check runs once the gate opens).
- `POST …/rotate` issues a new token in the same transaction that kills the old one; a map that is not shared answers `409 not_shared`. `DELETE` revokes and may be repeated.
- `repository.getSharedMemberMap(token)` is the lookup slice 2b will call: token format, then a fresh read, a constant-time digest compare, the owner not banned or deleted, then the projection built from live data (completed trips only, archived or not, destinations the catalog knows, sorted by slug). Every failure returns `null`.
- `deleteUser` deletes the share row in the same transaction. A banned or soft-deleted owner reads as `null` while the row stays; a restore revives the link.
- Export writes `tokenDigest: null`; import resets every row to no token and `anonymous`, so importing a file never publishes anything.

### The public page (slice 2b)

- `force-dynamic`; the token is read from the path, never cached. Headers (restated in `next.config.ts` as `mapSharePaths`): `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`. Metadata is generic and never depends on the token or the owner: a fixed title, `robots: noindex`, `referrer: no-referrer`; no alternates, no Open Graph, no JSON-LD. The path is disallowed in `robots.txt` and is not in the sitemap.
- **One answer for every failure.** `loadSharedMemberMap` (`src/server/planner/shared-map-page.ts`) returns `null` for a malformed or unknown token, a revoked or unshared map, a banned, soft-deleted or deleted owner, a store error and the read limiter alike, and the page calls `notFound()` — the same 404 for all of them. The limiter does not get its own 429 page, so nothing tells a visitor which case it was.
- The map reuses `VietnamMap` and its pin rules (fixed labels only for `featured` places, 44px targets, solid dot = visited). Only visited points exist in the projection; bucket 1 / 2–3 / 4+ is drawn with the three existing pin sizes (1, 2 and 4 visits). A slug outside the catalog is dropped. The list beside the map names each place and its bucket in words, so the size is not conveyed by the dot alone. `src/content/destinations.ts` is not touched.
- The name is shown (as plain text in the body, in the `<h1>`) only when the projection carries one, i.e. `name` mode — which stays closed for now, so every shared map is anonymous. It never enters the title, metadata or URL.
- nginx (`deploy/nginx/default.conf`): the two paths are **not logged at all** (`access_log … if=$cnh_loggable`), the redaction map also masks them as a second line of defence, and no nginx cache is configured. The raw request line can still appear in `error.log`, which is already treated as sensitive. **The live VM has not been inspected:** the owner must apply the new config and check it (see the operations runbook).

## Files

| Path | Role |
|---|---|
| `db/migrations/0016_member_map_shares.sql`, `db/rollback/0016_member_map_shares.sql` | Table and manual rollback |
| `src/server/planner/schemas.ts` | `memberMapShareSchema`, strict input schema |
| `src/server/planner/member-map-share.ts` | Token, digest, name guard, buckets, public projection (pure) |
| `src/server/planner/repository.ts` | `getMemberMapShare`, `setMemberMapShare`, `rotateMemberMapShare`, `revokeMemberMapShare`, `getSharedMemberMap`, `deleteUser` |
| `src/server/persistence/planner-rows.ts`, `planner-transfer.ts`, `src/server/planner/store.ts` | Table mapping, export without digest, import never enables |
| `src/app/api/planner/map/share/route.ts`, `…/rotate/route.ts` | Owner API |
| `src/server/rate-limit.ts`, `src/server/planner/instance.ts` | Share-change and public-read limiters |
| `src/app/[locale]/shared-map/[token]/page.tsx`, `src/server/planner/shared-map-page.ts` | Public page; loader (all failures → `null`) and pin sizes |
| `next.config.ts`, `src/app/robots.ts`, `src/i18n/routing.ts`, `messages/*.json` (`sharedMap`), `deploy/nginx/default.conf` | Headers, robots, route, copy, log rule |

## Tests

`tests/member-map-share.test.ts` (pure helpers; token shown once and only the digest stored; rotate; revoke idempotent; name gate and 422 guard; every failure reads as `null`; projection allow-list, archived-completed kept, deleted trip gone; two members isolated; banned and soft-deleted owner; `deleteUser`; audit has no token or name; export drops the digest; import never enables; older file without the key). `tests/member-map-share-routes.test.ts` (401 for every method, cross-origin and origin-less mutations refused, strict bodies, `share_name_unavailable`, isolation between members, own rate-limit bucket, audit rows). `tests/member-map-shared-page.test.ts` (slice 2b: the loader returns `null` for malformed, unknown, revoked, banned, deleted-owner and rate-limited requests; the projection has only `slug` and `visitsBucket`, no planned places and no name; deleted trip leaves, archived-completed stays; slug outside the catalog dropped; headers, robots, sitemap, no JSON endpoint, metadata free of the token and owner; VI/EN keys). `tests/deploy-config.test.ts` covers the nginx log rule and the absence of a cache. PostgreSQL is covered by the shared table-engine tests only; a database round trip of the new table is **not** covered (NOT RUN without `TEST_DATABASE_URL`).

## Limits and open questions

- No controls and no preview yet (slice 2c). A lost link must be rotated; it cannot be shown again.
- `name` mode stays closed until `profilePublicOpen` is built and the owner's Privacy Policy is published (ADR 0030, owner question 1).
- The migration is not applied by any agent. The nginx rule for `/shared-map/*` is in the repository, but the live VM has not been inspected and the rule is not applied there.
- A sparse map can still identify its owner to someone who already knows them; the `sparse` flag only supports a warning.
- `/sec-check` on slices 2a and 2b is **not run**; recommended again on 2b because the public page takes a bearer token from the URL.
- The page itself was not rendered in a browser for this change (NOT RUN, see the handoff).
