# Feature — Member map sharing (store and owner API)

🇻🇳 Bản tiếng Việt: [member-map-sharing.vi.md](member-map-sharing.vi.md)

## Summary

A signed-in member can switch on a share link for their own map of visited places, rotate it, or revoke it. This is **slice 2a** of ADR [0030](../adr/0030-member-map-sharing.md): the store, the migration and the owner API only. There is **no public page yet** (`/shared-map/[token]`, slice 2b) and **no controls on `/my-map`** (slice 2c), so a token issued here opens nothing until 2b ships. Sharing is off and anonymous by default; the token is shown once and only its SHA-256 digest is stored.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `GET /api/planner/map/share` | same | same |
| `PUT /api/planner/map/share` | same | same |
| `DELETE /api/planner/map/share` | same | same |
| `POST /api/planner/map/share/rotate` | same | same |

API routes are not localised. The public page (2b) and the controls (2c) are not part of this slice.

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

## Tests

`tests/member-map-share.test.ts` (pure helpers; token shown once and only the digest stored; rotate; revoke idempotent; name gate and 422 guard; every failure reads as `null`; projection allow-list, archived-completed kept, deleted trip gone; two members isolated; banned and soft-deleted owner; `deleteUser`; audit has no token or name; export drops the digest; import never enables; older file without the key). `tests/member-map-share-routes.test.ts` (401 for every method, cross-origin and origin-less mutations refused, strict bodies, `share_name_unavailable`, isolation between members, own rate-limit bucket, audit rows). PostgreSQL is covered by the shared table-engine tests only; a database round trip of the new table is **not** covered (NOT RUN without `TEST_DATABASE_URL`).

## Limits and open questions

- No public page, no controls and no preview yet (slices 2b and 2c). A lost link must be rotated; it cannot be shown again.
- `name` mode stays closed until `profilePublicOpen` is built and the owner's Privacy Policy is published (ADR 0030, owner question 1).
- The migration is not applied by any agent. The nginx rule for `/shared-map/*` (no access log, no cache) belongs to slice 2b and the live VM has not been inspected.
- A sparse map can still identify its owner to someone who already knows them; the `sparse` flag only supports a warning.
- `/sec-check` on this slice is **not run**; recommended (migration, trust boundary, token handling).
