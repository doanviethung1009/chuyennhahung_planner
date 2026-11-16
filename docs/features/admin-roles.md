# Feature — Admin roles

🇻🇳 Bản tiếng Việt: [admin-roles.vi.md](admin-roles.vi.md)

## Summary

Every Planner user now carries a role — `member`, `editor` or `admin` — and an
operator holding `ADMIN_API_TOKEN` can create or promote the first admin. This is
steps 1–2 of [ADR 0006](../adr/0006-unified-identity-and-roles.md): the role is
recorded and resolved, but nothing in the request path enforces it yet, so no
user-visible behaviour changes. *Historical:* later changes enforce it — see
[admin-portal.md](admin-portal.md), [admin-content-cms.md](admin-content-cms.md) and
[super-admin-accounts.md](super-admin-accounts.md) (which adds `super_admin`).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `PATCH /api/admin/planner/users/[userId]` | same | same |
| `POST /api/admin/planner/users` (gains optional `role`) | same | same |

API routes are not localized. The PATCH route is gated by the admin token only;
a session cookie, or no token, is a 401.

## Data

`PlannerUser.role` is optional (`member` | `editor` | `admin`); a row stored before
this change has none and reads as `member`. The public user always returns the
resolved `role`. `PlannerIdentity.role` is resolved per request from the user row.
`createdVia: 'google'` never confers a role: a first Google sign-in stores
`role: 'member'`.

## How it works

`src/server/identity/permissions.ts` is pure. `userRole(user)` is the single place an
absent role becomes `member`; reads never rewrite the stored row. `can(principal,
action)` consults a static map: `member` none; `editor` `template:write` and
`story:publish`; `admin` those plus `user:provision` and `user:promote`; `service`
all four. `trip:support-read` is reserved and granted to no one. An unknown role or
action is denied. (At this step no route called `can`; today every admin route and page does.)

`PATCH` parses `{ role }` with a strict schema (an extra key such as `email` is a
422, because this route grants privilege), then `setUserRole`. The same role again
returns 200 and writes nothing, so `updatedAt` is unchanged. Demotion is allowed
and there is no last-admin guard; the token can always re-promote. Sessions are not
revoked: `identify` reads the role on every request. Unknown user is 404.
Validation failures use the existing `validation_failed` / 422 shape shared with the
sibling routes.

## Files

| Path | Role |
|---|---|
| `src/server/identity/permissions.ts` | `Role`, `Action`, `ROLE_ACTIONS`, `can`, `userRole` |
| `src/server/planner/schemas.ts` | `role` on the stored, create and public user; strict role-update schema |
| `src/server/planner/auth.ts` | `PlannerIdentity.role`, set on the bearer path |
| `src/server/planner/repository.ts` | `identify` (cookie path), `createUser`, `setUserRole`, Google create |
| `src/app/api/admin/planner/users/route.ts` | POST accepts `role` |
| `src/app/api/admin/planner/users/[userId]/route.ts` | new `PATCH` |
| `tests/planner-roles.test.ts` | the invariants below |

## Tests

`tests/planner-roles.test.ts` asserts: a legacy row reads as `member` without being
rewritten; `identify` returns the stored role on the cookie and bearer paths; the
full `can` matrix, including `trip:support-read` denied to all and unknown roles
denied; PATCH promote, idempotent repeat, demotion, 404, 401 (no token, wrong token,
member session) and 422 (invalid, missing and extra key); POST with, without and
with an invalid role; the admin token and an admin-role session still cannot read
another user's trip; no `tokenHash`, `passwordHash` or `googleSub` in any public
user; a first Google sign-in is `member`.

## Limits and open questions

*At this step* nothing enforced a role; the admin portal, content CMS and ADR 0017 now do. PATCH rests entirely on `ADMIN_API_TOKEN` (rate limit and
timing-safe compare live in `adminPlannerRoute`). There is no audit log, admin UI,
session-path admin route, MFA or identity provider (ADR 0006 steps 3–4). Open owner
questions from the ADR remain: provider choice, who the admins are, and whether
`admin` requires MFA.
