# Feature — Super admin accounts

🇻🇳 Bản tiếng Việt: [super-admin-accounts.vi.md](super-admin-accounts.vi.md)

## Summary

A `super_admin` role above `admin` ([ADR 0017](../adr/0017-super-admin-role.md)). Only a super admin opens the Runbook tab, and an admin can no longer take over another admin account. Banning and deleting staff accounts follow in a later PR.

## Routes

None new. `/admin/runbook` (`/quan-tri/runbook`, `/en/admin/runbook`) now answers 404 to everyone but a super admin.

## Data

`Role` is `member | editor | admin | super_admin`, stored on the user row (additive, no migration). New action `runbook:read`, held by `super_admin` only. Message key `admin.roles.super_admin`.

## How it works

1. `can(super_admin)` = every admin action + `runbook:read`.
2. `requireStaff(..., 'runbook')` gates the page; `AdminNav` shows the link by `canRunbook`.
3. `canManageRole(actor, target)`: an admin session may create, re-role or reset the password of `member` and `editor` accounts only; a super admin or the service token may act on any. The check also runs again inside the transaction, so a demoted actor is refused.
4. The last `super_admin` cannot be demoted or deleted; `admin` and `super_admin` both count for "the last admin".
5. Make the first super admin with the service token: `PATCH /api/admin/planner/users/:id` body `{"role":"super_admin"}`.

## Files

| Path | Role |
|---|---|
| `src/server/identity/permissions.ts` | `super_admin`, `runbook:read`, `isAdminRole`, `canManageRole` |
| `src/server/planner/repository.ts` | Actor guards in `createUser`, `setUserRole`, `resetUserPassword`; last-super-admin guard; admin session lifetime |
| `src/app/api/admin/planner/users/route.ts` | Passes the session actor to `createUser` |
| `src/lib/admin-gate.ts` | `requireStaff(..., 'runbook')`, `canRunbook` |
| `src/components/admin/admin-nav.tsx` | Runbook link by `canRunbook` |
| `src/components/admin/{types,user-table,create-user-form,admin-console}.tsx` | Role choices limited to what the actor may assign |
| `messages/{vi,en}.json` | `admin.roles.super_admin` |
| `tests/super-admin.test.ts`, `tests/planner-roles.test.ts`, `tests/runbook.test.ts` | Tests below |

## Tests

`tests/super-admin.test.ts` asserts that an admin cannot create or promote to `admin`/`super_admin`, cannot re-role or reset a super admin, that a demoted actor is refused, that a super admin can, and the last-super-admin guard. `tests/planner-roles.test.ts` pins the permission matrix; `tests/runbook.test.ts` pins the gate and nav link. Not tested: the page gate in a browser; the UI role selector.

## Limits and open questions

- Existing admins lose the Runbook, and the right to manage other admins, until the first super admin exists.
- Ban/unban and staff delete are not in this PR.
- A review with `/sec-check` is recommended and has not been run.
