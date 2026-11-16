# Feature — Admin shell

🇻🇳 Bản tiếng Việt: [admin-shell.vi.md](admin-shell.vi.md)

## Summary

One frame for every admin page: a grouped, role-aware sidebar, a breadcrumb, a skip link and a working phone menu. `/admin` becomes a minimal overview (the dashboard counts arrive with P07-11) and the user console moves, unchanged, to `/admin/users`. Design decision: [ADR 0020](../adr/0020-admin-workspace-shell.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |
| `/admin/users` | `/quan-tri/nguoi-dung` | `/en/admin/users` |

Every other admin URL is unchanged. `/admin/users` is `noindex`, a valid `returnTo` (query kept) and gated on `user:provision`.

## Data

No data and no API change. Message keys: `adminContent.nav` (groups, links, menu, skip, breadcrumb) and `adminContent.overview` (title, description) in both catalogues.

## How it works

`src/app/[locale]/admin/layout.tsx` reads `readStaffPageAccess()` (wrapped in `cache()`, so once per request) and, for staff only, draws the frame. It never redirects or 404s: each page keeps its own `requireStaff` gate and `returnTo`; for anyone else the page redirects or 404s and the frame is not drawn. `adminSidebarGroups(principal)` in `src/lib/admin-gate.ts` is a pure function of `can()` that returns the groups the role sees (an editor never sees People or Operations; empty groups are dropped; Media is not rendered until Phase 08). `AdminSidebar` is a client island only for the phone menu toggle and `aria-current` (matched on the link's page and its detail pages). Hiding a link is not authorization.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/admin/layout.tsx` | Frame: skip link, sidebar, breadcrumb |
| `src/components/admin/admin-sidebar.tsx` | `AdminSidebar` and `AdminBreadcrumb` (replace `AdminNav`) |
| `src/lib/admin-gate.ts` | `adminSidebarGroups` |
| `src/app/[locale]/admin/users/page.tsx` | The user console, moved |
| `src/app/[locale]/admin/page.tsx` | Overview |
| `src/server/planner/admin-page.ts` | `readStaffPageAccess` in `cache()` |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | `/admin/users` route and `returnTo` entry |

## Tests

`tests/admin-portal.test.ts`: the new route and `returnTo` near-misses, the layout and page wiring, sidebar visibility per role. `tests/runbook.test.ts`: the Runbook link is hidden unless `runbook:read`. `tests/i18n.test.ts`, `tests/docs.test.ts`, `tests/client-boundary.test.ts` cover parity, docs and the client boundary.

## Limits and open questions

A bookmarked `/quan-tri` now shows the overview, not the user table. Dashboard counts, the audit, system and collection screens and `/admin/users/roles` are separate tasks (P07-11 to P07-18); until they ship their links are not rendered. The 375/768/1280px visual pass is recorded in the PR.
