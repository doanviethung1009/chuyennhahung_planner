# Feature — Admin portal (slice 1)

🇻🇳 Bản tiếng Việt: [admin-portal.vi.md](admin-portal.vi.md)

## Summary

A browser page where a signed-in administrator manages Planner users without
`curl`: list users, create one, change a role, reissue a password. It serves the
owner and nobody else; it is not linked from any public navigation. Design
decision: [ADR 0010](../adr/0010-admin-portal-session-authorization.md). The
role model is in [admin-roles.md](admin-roles.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |

The route is the architect's table entry; the frontend added it to `src/i18n/routing.ts` under the approved contract. It uses the existing `/api/admin/planner/users*` endpoints, which gained cookie-session access in the same slice (backend).

## Data

- Reads `GET /api/admin/planner/users` (`{ users, count }`): `id`, `handle`, `displayName`, `email?`, `role?` (absent reads as `member`), `createdAt`. No credential hash is ever returned.
- Writes `POST /api/admin/planner/users`, `PATCH /api/admin/planner/users/:id` (`{ role }`) and `POST /api/admin/planner/users/:id/reset-password`.
- One-time secrets (`accessToken`, `temporaryPassword`) exist only in React state.
- Messages: the `admin` namespace in `messages/vi.json` and `messages/en.json`. Server-side error text is never shown; each error `code` maps to a localized message.

## How it works

1. `src/app/[locale]/admin/page.tsx` is a dynamic server component. `readAdminPageAccess()` decides: anonymous redirects to the localized sign-in with `returnTo` set to the admin page; an admin on a temporary password redirects to the change-password page; any other signed-in user gets `notFound()`; an admin renders the page. Metadata is `noindex, nofollow`.
2. One client island, `AdminConsole`, sits below the heading. It is a client component because it holds form state, calls same-origin `fetch` with the session cookie, and keeps secrets in memory. It never holds `ADMIN_API_TOKEN`.
3. The table has a row per user: a role `<select>` with Save, and Reset password with an inline confirm step. The signed-in admin's own row has both disabled (the server refuses too).
4. After create or reset, a clearly marked panel shows the secret once, with a Copy button (and a selectable read-only field when the clipboard is unavailable, as on plain HTTP) and an "I have saved it" dismiss.
5. Results and errors go to one `aria-live` region. `401` offers a sign-in-again link; `403`, `409`, `422` (named fields), `429` (seconds from `Retry-After`) and `404` each have their own message.
6. A sign-out button reuses `DELETE /api/planner/session`.
7. `robots.txt` disallows both paths, `next.config.ts` sends `X-Robots-Tag: noindex, nofollow`, the sitemap does not list the page, and `safeReturnTo` allows `/quan-tri` and `/en/admin`.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/admin/page.tsx` | Server gate, metadata, one `<h1>` |
| `src/components/admin/admin-console.tsx` | Client island: fetching, status region, error mapping, sign-out |
| `src/components/admin/user-table.tsx` | Users table, role change, reset with confirm |
| `src/components/admin/create-user-form.tsx` | Create-user form |
| `src/components/admin/secret-panel.tsx` | One-time secret display and copy |
| `src/components/admin/types.ts` | API shapes the UI reads |
| `src/components/planner/api.ts` | `ApiError` now carries 422 `issuePaths` |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Route and `returnTo` allow-list |
| `src/app/robots.ts`, `next.config.ts` | Crawler exclusion |
| `messages/vi.json`, `messages/en.json` | `admin` namespace |
| `tests/admin-portal.test.ts` | Tests below |
| `scripts/admin-create.ts`, `src/server/planner/admin-bootstrap.ts` | `npm run admin:create`: first admin with a random temporary password, straight into the store |

## Tests

`tests/admin-portal.test.ts` asserts the route entry, the `returnTo` allow-list (and near-miss rejections), `robots` disallow, the sitemap source never naming the route, the `X-Robots-Tag` rules with the tour redirects intact, and that no file in `src/components/admin` names `ADMIN_API_TOKEN`, reads `process.env`, imports `src/server` or touches web storage. `tests/client-boundary.test.ts`, `tests/i18n.test.ts`, `tests/return-to.test.ts` and `tests/design-tokens.test.ts` cover the rest. The server gate itself is covered by `tests/planner-admin-session.test.ts` (backend); `admin:create` by `tests/admin-bootstrap.test.ts`. Not tested: the island's interactions in a browser (no DOM test runner is installed).

## Limits and open questions

- Slice 1 only: no content CMS, audit log, MFA, delete user, token rotation or Google unlink in the browser.
- Any admin can reset another admin's password until an audit log exists (ADR 0010).
- A member, an editor and an expired session cannot tell "no such page" from "not allowed": non-admins get 404 by design; the 404-versus-403 choice is an open owner question in the ADR.
- The rate limit is per process.
- Plain HTTP on a LAN exposes the password and the cookie; use HTTPS beyond development.
