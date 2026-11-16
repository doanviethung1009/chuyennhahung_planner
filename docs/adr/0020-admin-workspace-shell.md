# ADR 0020 — Admin Workspace shell: one layout, a grouped sidebar, `/admin` as a dashboard

🇻🇳 Bản tiếng Việt: [0020-admin-workspace-shell.vi.md](0020-admin-workspace-shell.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-17
- **Owner:** system-architect
- **Affects:** `src/app/[locale]/admin/**`, `src/components/admin/admin-nav.tsx`, `src/i18n/routing.ts`, `src/lib/return-to.ts`, `src/server/identity/permissions.ts` (one action), `messages/*.json`
- **Part of:** Phase 07 (Admin Portal, CMS & RBAC); design in [specs-admin-workspace.md](../specs-admin-workspace.md)

## Context

The admin portal grew page by page (ADR 0010, 0011, 0017). There is no shared layout; each page
renders a header and a flat pill row, and `/quan-tri` is the user table for admins. Phase 07
still lists audit log and CMS create/delete, Phase 10 adds reports and events, Phase 08 adds
media. Each would need a nav entry and a place to live, and the root route currently means
"manage users", which most staff do not need first.

What we do not know: how many users the table must list (it has no pagination), and whether any
admin has bookmarked `/quan-tri` expecting the table.

## Decision

1. **One `layout.tsx`** under `src/app/[locale]/admin/` owns the sidebar, skip link and breadcrumb.
   Pages keep their own `requireStaff` gate and single `<h1>`. The staff-access read is wrapped
   in `cache()` so it runs once per request.
2. **Grouped, role-aware sidebar** replaces `AdminNav`: Overview, Content, Community, People,
   Media (hidden until Phase 08), Operations. Visibility comes from `can()`; it is not authorization.
3. **`/admin` becomes the dashboard**; the user console moves unchanged to `/admin/users`
   (`/quan-tri/nguoi-dung`). Every other existing URL is kept.
4. **New routes** are added to `pathnames` and the `returnTo` allow-list: `/admin/users`,
   `/admin/users/roles`, `/admin/content/collections`, `/admin/content/integrity`, `/admin/audit`,
   `/admin/system`.
5. **One new action, `audit:read`** (admin, super admin, service). Everything else reuses existing actions.
6. **No new data store, no new auth path.** Screens call existing or additive APIs.

## Options considered

| Option | Verdict |
|---|---|
| Keep `/admin` as users, add `/admin/overview` | Safe for bookmarks, but the entry point stays the least-used screen and editors still land on a stub |
| Sidebar only inside `AdminNav`, no layout | Every page keeps duplicating header and nav; no breadcrumb or mobile menu in one place |
| Separate admin app or hosted admin framework | Duplicates auth and components; violates reuse and CLAUDE.md rule 6 |
| **Layout + sidebar + dashboard at `/admin` (chosen)** | One frame, additive routes, one moved screen |

## Consequences

- Positive: new screens plug into one frame; editors get a useful landing page; Phase 10 and 08 features have a defined slot.
- Negative: a bookmarked `/quan-tri` now shows the dashboard; `tests/admin-portal.test.ts` assertions about the `/admin` route change.
- Risks: the layout reads the session once more than today (mitigated by `cache()`); the moved route must keep the temporary-password and `returnTo` redirects.
- Rollback: restore the old `page.tsx` content and `AdminNav`; the new routes can stay unlinked. No data to undo.
- Follow-ups: the contracts `P07-10`…`P07-18` in `.claude/contracts/`; status flips to Accepted at the start of `P07-10`, on the owner's yes.
