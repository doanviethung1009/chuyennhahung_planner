# Feature — Admin users and roles

🇻🇳 Bản tiếng Việt: [admin-users-roles.vi.md](admin-users-roles.vi.md)

## Summary

Admins do in the browser what was `curl`-only: unlink a user's Google sign-in and rotate their access token, and page through large user lists. A read-only page shows what each role may do and whose accounts each role may manage. It adds no role, no action and no audit event (P07-12).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/users/roles` | `/quan-tri/nguoi-dung/vai-tro` | `/admin/users/roles` |

API (additive): `GET /api/admin/planner/users?limit&cursor&sort`, `DELETE /api/admin/planner/users/[userId]/google`, `POST /api/admin/planner/users/[userId]/rotate-token` (these two now also accept the admin session cookie).

## Data

Reads `ROLE_ACTIONS` and `canManageRole` (`src/server/identity/permissions.ts`); message namespace `adminRoles`, plus `admin.users` and `admin.status` keys for the new buttons. `AdminUser.hasGoogle` (already public) decides whether *Unlink Google* is offered.

## How it works

- **Matrix:** a server component with no props; every cell is computed from the permission source, so it cannot drift. Two tables: actions per role, and which target roles each role may manage. Gated like the user console (`user:provision`; others get 404).
- **Paging:** no query = every account, as before. Any of `limit` (1–200, larger values are capped), `cursor`, `sort` (`handle` default, `created`, `-created`) switches on keyset paging; the response adds `total` and `nextCursor`. A cursor names the last row seen (sort key + id), so an account created between pages is never repeated or skipped. A malformed cursor, or one from another sort, is 422. The repository is untouched: the route slices the existing list (`src/server/planner/user-page.ts`).
- **Credential acts:** the console asks for the existing confirmation, then calls the API. For a session actor the route checks `canManageRole` against the target before writing (admin → member/editor only; super admin → anyone; 403 with reason `manage_role` otherwise, 404 for an unknown id; rotating your own token is 409 `self_action`). A rotated token comes back once, `no-store`, and lives only in component state in `SecretPanel`.
- **UI paging:** the console loads 50 at a time with *Load more*. Search and role filters run over the rows already loaded; a note says so while more remain.

## Files

| Path | Role |
|---|---|
| `src/server/planner/user-page.ts` | cursor encode/validate, sort, slice |
| `src/server/planner/manage-user.ts` | `canManageRole` check for the two routes |
| `src/app/api/admin/planner/users/route.ts` | paging query |
| `src/app/api/admin/planner/users/[userId]/{google,rotate-token}/route.ts` | session access + role check |
| `src/components/admin/roles-matrix.tsx` | matrix |
| `src/app/(admin)/[locale]/admin/users/roles/page.tsx` | page |
| `src/components/admin/{admin-console,user-table,types}.ts*` | paging and two new actions |
| `src/i18n/routing.ts`, `src/lib/return-to.ts`, `messages/*.json` | path, return-to, strings |

## Tests

`tests/admin-roles-matrix.test.ts`: roles and actions equal the source; every one has a VI and EN label; both paths exist. `tests/admin-users-paging-credentials.test.ts`: no query is unchanged; paging visits every account once for each sort, including after a concurrent create; `limit` cap, bad `limit`/cursor/sort and foreign-sort cursor are 422; 401/403/404 and the admin-on-admin refusal for both actions; new token once, `no-store`, old token dead. Browser smoke at 375/768/1280: NOT RUN.

## Limits and open questions

- Filters do not search unloaded pages; no server-side filter was added (out of scope).
- The role check happens in the route, not the repository (that file is shared with Phase 10), so a role change between check and write is a narrow race.
- Paging slices an in-memory list; it bounds the response, not the repository read.
- No audit event is added here (P07-13); existing `token_rotate` / `google_unlink` records now carry the acting admin. `/sec-check` is recommended and NOT RUN.
