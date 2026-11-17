# Feature — Admin shell

🇻🇳 Bản tiếng Việt: [admin-shell.vi.md](admin-shell.vi.md)

## Summary

One frame for every admin page, in its own root layout apart from the visitor site (no public header, nav or footer): a slim top bar, a grouped role-aware sidebar, a breadcrumb, a skip link, a phone menu and one compact `AdminPageHeader` per page. `/admin` becomes a minimal overview (the dashboard counts arrive with P07-11) and the user console moves, unchanged, to `/admin/users`. Design decisions: [ADR 0020](../adr/0020-admin-workspace-shell.md) and [ADR 0023](../adr/0023-admin-root-layout.md) (P07-19).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |
| `/admin/users` | `/quan-tri/nguoi-dung` | `/en/admin/users` |

Every other admin URL is unchanged; the pages moved on disk to `src/app/(admin)/[locale]/admin/**`, URLs did not. `/admin/users` is `noindex`, a valid `returnTo` (query kept) and gated on `user:provision`.

## Data

No data and no API change. Message keys: `adminContent.nav` (groups, links, menu, skip, breadcrumb, brand, viewSite), `adminContent.notFound` and `adminContent.overview` (title, description) in both catalogues.

## How it works

`src/app/(admin)/[locale]/admin/layout.tsx` reads `readStaffPageAccess()` (wrapped in `cache()`, so once per request) and, for staff only, draws the frame. It never redirects or 404s: each page keeps its own `requireStaff` gate and `returnTo`; for anyone else the page redirects or 404s and the frame is not drawn. `adminSidebarGroups(principal)` in `src/lib/admin-gate.ts` is a pure function of `can()` that returns the groups the role sees (an editor never sees People or Operations; empty groups are dropped; Media is not rendered until Phase 08). `AdminSidebar` is a client island for `aria-current` (matched on the link's page and its detail pages). Hiding a link is not authorization.

P07-19 (ADR 0023) gave admin its own root layout (`src/app/(admin)/[locale]/layout.tsx`: `<html>`, shared fonts, `noindex`, no `SiteHeader`/`SiteFooter`). `AdminTopBar` (sticky, `--admin-bar-h`) holds the brand, View site, language, handle and role, and `AdminSignOut`; below 768px it keeps the brand and one Menu button whose panel (`AdminMobileMenu`) holds the groups and the account actions, and closes on navigation and Escape. The sidebar is sticky under the bar (12rem from `md`, 16rem from `xl`) and scrolls itself; the active item has a 3px primary bar, a tint and weight 600, never colour alone; Overview is one top link. `AdminPageHeader` (`title`, `description?`, `actions?`) is the one h1 of every admin page. The single admin `not-found` serves forbidden roles and unknown admin URLs (two `[...rest]` catch-alls feed it), so the 404 is no oracle.

## Files

| Path | Role |
|---|---|
| `src/app/(admin)/[locale]/layout.tsx`, `not-found.tsx` | Admin root layout and the one admin 404 |
| `src/app/(admin)/[locale]/{admin,quan-tri}/[...rest]/page.tsx` | Unknown admin URLs end in the admin 404 |
| `src/app/fonts.ts` | Fonts shared by both root layouts |
| `src/app/(admin)/[locale]/admin/layout.tsx` | Frame: skip link, top bar, sidebar, breadcrumb, `<main>` |
| `src/components/admin/admin-top-bar.tsx`, `admin-sign-out.tsx`, `admin-page-header.tsx` | Top bar, sign-out, page header |
| `src/components/admin/admin-sidebar.tsx` | `AdminSidebar`, `AdminMobileMenu`, `AdminBreadcrumb` |
| `src/lib/admin-gate.ts` | `adminSidebarGroups` |
| `src/app/(admin)/[locale]/admin/users/page.tsx` | The user console, moved |
| `src/app/(admin)/[locale]/admin/page.tsx` | Overview |
| `src/server/planner/admin-page.ts` | `readStaffPageAccess` in `cache()` |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | `/admin/users` route and `returnTo` entry |

## Tests

`tests/admin-layout.test.ts` (ADR 0023): no public chrome in the admin layout, one fonts module, `AdminPageHeader` on every page, one admin 404 for a forbidden role and an unknown URL, header and sidebar markup. `tests/admin-portal.test.ts`: the new route and `returnTo` near-misses, the layout and page wiring, sidebar visibility per role. `tests/runbook.test.ts`: the Runbook link is hidden unless `runbook:read`. `tests/i18n.test.ts`, `tests/docs.test.ts`, `tests/client-boundary.test.ts` cover parity, docs and the client boundary.

## Limits and open questions

A bookmarked `/quan-tri` now shows the overview, not the user table. Dashboard counts, the audit, system and collection screens and `/admin/users/roles` are separate tasks (P07-11 to P07-18); until they ship their links are not rendered. The 375/768/1280px visual pass is recorded in the PR. The language switcher's links are 36px tall (the shared component is unchanged); moving between admin and the visitor site is a full page load.
