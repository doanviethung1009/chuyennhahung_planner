# ADR 0017 — Super admin role and who may manage whom

🇻🇳 Bản tiếng Việt: [0017-super-admin-role.vi.md](0017-super-admin-role.vi.md)

- **Status:** Accepted (implemented in two PRs)
- **Date:** 2026-11-16
- **Owner:** system-architect

## Context

[ADR 0006](0006-unified-identity-and-roles.md) gave three roles; any `admin` can promote anyone to `admin`, reset any account's password and read the operations Runbook (ADR 0010/0011). Two gaps follow: the Runbook (API list, deploy and database guides) is reachable by every admin, and one compromised or careless admin can take over another admin by resetting its password. The owner wants a role above `admin`.

## Decision

1. `Role` gains `super_admin`. It holds every `admin` action plus a new `runbook:read`. `admin` and `editor` do **not** hold `runbook:read`.
2. The Runbook page is gated by `requireStaff(..., 'runbook')` (`can(role, 'runbook:read')`); anyone else gets a 404, and the nav link is rendered for `runbook:read` only.
3. `canManageRole(actor, target)`: a `super_admin` or the service token acts on any account; an `admin` acts only on `member` and `editor` accounts. It applies to `createUser`, `setUserRole` (both the current and the new role) and `resetUserPassword`. A refused call is `403 forbidden`.
4. Head-count guards: `admin` and `super_admin` both count as admin-capable for "the last admin"; the last `super_admin` cannot be demoted or deleted, the service token included.
5. `super_admin` uses the admin session lifetime (ADR 0010 §4). No new route, no schema migration: the stored role value is additive.
6. The first super admin is made with the service token (`PATCH /api/admin/planner/users/:id` with `{"role":"super_admin"}`) — an admin session cannot grant it.

7. **Account lifecycle (second PR).** `bannedAt/bannedBy` and `deletedAt/deletedBy` are optional fields on the user. A banned or soft-deleted account is *disabled*: all its sessions are removed at once, and `identify` (cookie and bearer), access-token sign-in, password sign-in and Google sign-in refuse it (Google reads it as `account_not_found`, so there is no distinct answer and no signup around it). Its trips, reviews and credentials are untouched, and unban or restore re-enables it.
8. Delete has two modes (owner decision): **soft** (`DELETE ?mode=soft`: disable and mark deleted, restorable with `POST .../restore`) and **hard** (`DELETE ?mode=hard`, the default as before: the row goes, refused while the account owns trips). A session may hard-delete only a staff account that was soft-deleted first; the service token keeps the direct path.
9. Ban, soft delete and restore apply to staff accounts (editor, admin, super admin) only, never yourself, and an admin acts only on editors (`canManageRole`). A disabled account no longer counts toward "the last admin" or "the last super admin", and a disabled actor cannot act.
10. No new Action names: the routes reuse `user:provision`. New routes: `POST .../ban`, `.../unban`, `.../restore`; `DELETE` now accepts a session.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): new role with a new `runbook:read` action | Matches the existing `can` map; one place to widen | Existing admins lose the Runbook until a super admin exists |
| B: keep `admin`, gate the Runbook by an allow-list of user ids | No role change | A second authorization mechanism beside roles |

B lost because it adds a parallel access list to audit.

## Consequences

Easier: the Runbook is limited to one trusted role; an admin cannot escalate itself or capture another admin. Harder: on an existing deployment nobody can open the Runbook, nor manage admins, until the service token promotes the first super admin; rolling the code back while a `super_admin` row exists fails the old role schema, so demote them first. Roles are still stored per user row and re-read on every request, so changes apply immediately.

## Follow-up

Run `/sec-check` on the lifecycle PR; update `docs/architecture.md`, `docs/usage.md` and the feature document [super-admin-accounts](../features/super-admin-accounts.md).
