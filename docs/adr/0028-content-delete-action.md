# ADR 0028 — `content:delete`: permanent deletion of a place is an admin action

🇻🇳 Bản tiếng Việt: [0028-content-delete-action.vi.md](0028-content-delete-action.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-19
- **Owner:** system-architect
- **Affects:** `src/server/identity/permissions.ts` (one action), `src/app/api/admin/travel/places/[slug]/route.ts` (`DELETE`), the admin place editor and the roles matrix page, `messages/*.json`. No database, migration or new route. Task Contract `CORE-10`; builds on [ADR 0006](0006-unified-identity-and-roles.md), [ADR 0011](0011-admin-content-cms.md) and [ADR 0017](0017-super-admin-role.md).

## Context

`DELETE /api/admin/travel/places/[slug]` accepted only `ADMIN_API_TOKEN`, so an admin could not remove a place from the browser. There was no action in `can()` for permanently removing content; the nearest ones (`community:erase`, `user:provision`) mean something else. The owner decided (2026-11-19) that permanent deletion is not an editor task, and asked for a delete button visible only to super admin and admin.

## Decision

1. **A new action `content:delete`.** Held by `admin`, `super_admin` and the service token; not by `editor` or `member`. It is added to `ROLE_ACTIONS`, the one place where permissions widen, and shows up in the roles matrix.
2. **The route opts in to sessions.** `DELETE places/[slug]` uses `adminContentRoute(request, { action: 'content:delete', session: true })`: the token still works; a session needs same-origin proof, is rate-limited (30 per minute per user) and is refused with 403 unless its role holds the action. The `place_in_use` (409) and fail-closed (503) rules of CORE-9 are unchanged.
3. **The button is a convenience, the API is the check.** The page computes `can(principal, 'content:delete')` on the server and passes a boolean to the editor, as the community page does for `community:erase`. Hiding the button is never the control.
4. **Scope is places only.** Stories, reviews, collections and templates keep their token-only `DELETE`.

## Consequences

- An admin session can now delete a place that nothing refers to, permanently. The 409 guard and the integrity report are the safety net; there is no soft delete or undo.
- One more row in the permission matrix; tests pin which principals hold it.
- Extending the same action to other content kinds later is a one-line route change plus a note here, not a new permission.
- Deletion is irreversible and is not guarded by `If-Match` (the reference guard of CORE-9 is the protection) and is not written to the audit log; both could be added later without changing the action.
