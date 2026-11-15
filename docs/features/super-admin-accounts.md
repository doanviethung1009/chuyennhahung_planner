# Feature — Super admin accounts

🇻🇳 Bản tiếng Việt: [super-admin-accounts.vi.md](super-admin-accounts.vi.md)

## Summary

A `super_admin` role above `admin` ([ADR 0017](../adr/0017-super-admin-role.md)). Only a super admin opens the Runbook tab, and an admin can no longer take over another admin account. Staff accounts (editor, admin, super admin) can also be banned, soft-deleted, restored or deleted permanently.

## Routes

API: `POST /api/admin/planner/users/[userId]/ban`, `/unban`, `/restore`; `DELETE .../[userId]?mode=soft|hard`. Pages: `/admin/runbook` (`/quan-tri/runbook`, `/en/admin/runbook`) now answers 404 to everyone but a super admin.

## Data

`Role` is `member | editor | admin | super_admin`, stored on the user row. On PostgreSQL migration `0009_super_admin_and_account_state.sql` widens the role CHECK and adds `banned_at/by`, `deleted_at/by` (mapped in `src/server/persistence/planner-rows.ts`); apply it before using either feature. New action `runbook:read`, held by `super_admin` only. User fields `bannedAt/bannedBy`, `deletedAt/deletedBy` (optional). Message keys under `admin.users` (`ban`, `unban`, `delete`, `restore`, `purge`, `status*`) and `admin.status.*Done`. Message key `admin.roles.super_admin`.

## How it works

1. `can(super_admin)` = every admin action + `runbook:read`.
2. `requireStaff(..., 'runbook')` gates the page; `AdminNav` shows the link by `canRunbook`.
3. `canManageRole(actor, target)`: an admin session may create, re-role or reset the password of `member` and `editor` accounts only; a super admin or the service token may act on any. The check also runs again inside the transaction, so a demoted actor is refused.
4. The last `super_admin` cannot be demoted or deleted; `admin` and `super_admin` both count for "the last admin".
5. Ban and soft delete mark the user *disabled*: sessions are removed at once and cookie, access-token, password and Google sign-in all refuse it; data stays. Unban and restore re-enable. Soft delete only disables and marks the account (it stays in the staff list with a "Deleted" badge), hard delete (`?mode=hard`, the default) removes the row and refuses while the user owns trips; a session may hard-delete only a soft-deleted staff account. Staff targets only, never yourself, an admin only on editors, and a disabled account no longer counts as "the last admin". In the user table each row offers Reset / Ban / Delete (soft), or Unban, or Restore / Delete permanently, each with a confirmation.
6. Make the first super admin with the service token: `PATCH /api/admin/planner/users/:id` body `{"role":"super_admin"}`.

## Files

| Path | Role |
|---|---|
| `src/server/identity/permissions.ts` | `super_admin`, `runbook:read`, `isAdminRole`, `canManageRole` |
| `src/server/planner/repository.ts` | Actor guards in `createUser`, `setUserRole`, `resetUserPassword`; last-super-admin guard; admin session lifetime |
| `src/app/api/admin/planner/users/route.ts` | Passes the session actor to `createUser` |
| `src/app/api/admin/planner/users/[userId]/{ban,unban,restore}/route.ts`, `.../[userId]/route.ts` | Lifecycle routes; `DELETE ?mode` |
| `tests/account-lifecycle.test.ts` | Lifecycle tests |
| `src/lib/admin-gate.ts` | `requireStaff(..., 'runbook')`, `canRunbook` |
| `src/components/admin/admin-nav.tsx` | Runbook link by `canRunbook` |
| `src/components/admin/{types,user-table,create-user-form,admin-console}.tsx` | Role choices limited to what the actor may assign |
| `messages/{vi,en}.json` | `admin.roles.super_admin` |
| `tests/super-admin.test.ts`, `tests/planner-roles.test.ts`, `tests/runbook.test.ts` | Tests below |

## Tests

`tests/super-admin.test.ts` asserts that an admin cannot create or promote to `admin`/`super_admin`, cannot re-role or reset a super admin, that a demoted actor is refused, that a super admin can, and the last-super-admin guard. `tests/account-lifecycle.test.ts` asserts that a ban ends sessions and blocks cookie, bearer, access-token, password and Google sign-in, that unban and restore undo it, soft delete keeps trips, the session-only hard-delete rule, and the self / role / last-admin guards. `tests/planner-roles.test.ts` pins the permission matrix; `tests/runbook.test.ts` pins the gate and nav link. Not tested: the page gate in a browser; the UI role selector.

## Limits and open questions

- Existing admins lose the Runbook, and the right to manage other admins, until the first super admin exists.
- Soft delete keeps the email and handle reserved; there is no purge-after-N-days job.
- Public content (listed trips, approved reviews) of a banned or soft-deleted user stays visible; only sign-in is blocked. Hiding it would need its own change.
- Members cannot be banned or soft-deleted (use review restrictions, ADR 0015).
- A review with `/sec-check` is recommended and has not been run.
