# Task Contract: super-admin-accounts — super admin role, ban/delete staff, password page for all
- Class: XL (authorization model + account lifecycle + sign-in path; trust boundary moves)
- Desired outcome / user impact: only a super admin opens the Runbook tab; staff accounts can be banned or deleted safely; every signed-in user with a password can reach a change-password page.
- Scope IN:
  1. `Role` gains `super_admin`; new Action `runbook:read` (+ `account:ban`, `account:delete`) held by super_admin only.
  2. `banned` state on a user; ban/unban/delete for admin/editor targets, with guards.
  3. `/account/password` linked from a signed-in entry point; verified for non-pending users.
- Scope OUT: MFA, hosted IdP, self-service reset, member self-delete, ban of `member` (use ADR 0015 restrictions).
- Evidence:
  - Roles: `src/server/identity/permissions.ts:10` (`member|editor|admin`), `ROLE_ACTIONS` :36.
  - Last-admin guard: `repository.ts` `setUserRole` :705 / `deleteUser` :746 via `assertAnotherAdminExists`; self-guard `selfAdminAction` :2958.
  - Session resolution: `repository.identify` :258 (role re-read per request; the place a ban must bite). Sessions dropped in `rotateUserToken`/`deleteUser`.
  - Runbook gate: `src/app/[locale]/admin/runbook/page.tsx` uses `requireStaff(...,'users')`; `src/lib/admin-gate.ts`; `src/server/planner/admin-page.ts`.
  - Admin API: `src/app/api/admin/planner/users/[userId]/route.ts` (PATCH role, DELETE with `adminPlannerRoute` default action `user:provision`, no actor passed -> self/last-admin checks only partly applied on DELETE).
  - Password: `/api/planner/password` (`allowPendingPasswordChange`), `repository.changePassword` :395 works for any user with a hash; `src/app/[locale]/account/password/page.tsx` + `change-password-form.tsx` already serve non-pending users — gap is discoverability (no link outside the forced redirect), not capability.
- Constraints: ADR 0006 role map, ADR 0010 §4 (session lifetime by role) and §6 (self/last-admin), ADR 0007; no new dependency; VI+EN parity; docs twins.
- ADR: new ADR 0017 "Super admin and account lifecycle" (extends 0006/0010; notes 0007), EN+VI, registered in `docs/adr/README*`.
- Interface contract (proposed, pending owner answers):
  - `roleSchema = member|editor|admin|super_admin`; `can(super_admin)` = all admin actions + `runbook:read`, `account:ban`, `account:delete`. Admin keeps `user:provision`, `user:promote` (cannot grant/touch super_admin — escalation guard).
  - `PlannerUser.bannedAt?: string`, `bannedBy?: string` (optional, absent = active; backward compatible with JSON and Postgres docs).
  - `POST /api/admin/planner/users/[userId]/ban` and `/unban`; `DELETE .../[userId]` gains guards. `identify` throws `forbidden`/`unauthorized` for banned users (cookie and bearer), `ban` drops sessions (default).
  - Guards: no self ban/delete; cannot ban/delete last super_admin (or last admin-capable account); only super_admin acts on admin/super_admin targets; admin may act on editor? (open question).
  - Runbook: `requireStaff(..., 'runbook')` + `can('runbook:read')`; nav item hidden otherwise; tests/runbook.test.ts table updated EN+VI for new routes.
  - Bootstrap: how the first super_admin is created (`admin-bootstrap.ts` env) — open question.
- Tasks by owner: Architect: ADR + this contract. BE: permissions, schemas, repository, routes, identify/ban, bootstrap. FE: nav, user-table actions + confirm dialogs, password link, messages vi/en. QC/Security: NOT RUN (user-triggered; recommend `/sec-check`).
- File ownership: single agent, sequential; no subagents.
- Acceptance: permissions matrix tests; ban blocks cookie+bearer+Google sign-in; self/last-super-admin guards; editor/admin get 404 on runbook, super_admin 200; delete semantics per answer; docs.test + runbook.test green; typecheck/lint/test output stated.
- Security and migration risks: privilege escalation (admin promoting self/others to super_admin); lock-out (no super_admin left; existing admins lose Runbook until one is promoted); ban bypass via Google sign-in or access token; deletion cascade (trips/reviews, ADR 0014); stored role value migration (additive enum, no data rewrite).
- Rollback: revert PR; `bannedAt` is optional so old code ignores it; users with `super_admin` role would fail old zod parse — roll back only after demoting them (note in ADR).
- Budget: 0 subagents. Stop condition: each PR awaits owner approval before commit/push.
- State: IN_PROGRESS (PR A)
- Feature document owner: main session (BE hat) — `docs/features/super-admin-accounts.md` + `.vi.md`, row in `docs/features/README*`.
- Architecture/usage doc updates: `docs/architecture.*` (roles/permissions), `docs/usage.*` (admin ops), `docs/runbook.*` API table.

## Owner decisions (answered in session)
1. PR order 3 -> 1 -> 2, three PRs, one branch/PR each (PR A password page, PR B super_admin + Runbook + ADR 0017, PR C ban/delete).
2. Ban ends sessions at once and blocks cookie + bearer + Google sign-in; unban restores.
3. (Revised by owner mid-PR C) Delete has BOTH modes: soft (`deletedAt`, hidden + sign-in blocked + restorable) and hard (existing `deleteUser`, permanent). `DELETE ?mode=soft|hard`, default `hard` (backward compatible). A session actor may hard-delete only an account already soft-deleted; the service token keeps today's behaviour. Self / last-admin guards on both. Actions reuse `user:provision` + `canManageRole` (no new Action names); ban/soft-delete limited to staff targets (editor/admin/super_admin).
4. An admin may also ban/delete an editor; only super_admin acts on admin/super_admin targets. First super_admin: via existing `admin-bootstrap` / service token (still to confirm in PR B).
