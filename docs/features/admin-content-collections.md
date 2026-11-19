# Feature — Admin collections and integrity (P07-15)

🇻🇳 Bản tiếng Việt: [admin-content-collections.vi.md](admin-content-collections.vi.md)

## Summary

Editors manage destination collections in the browser — list, search, sort, edit with vi and en side by side, and publish or unpublish — and read a read-only integrity report that lists broken references in the content store. Admins also see the Planner integrity report. The screens sit on APIs that already existed; the only API changes are an access guard (token-only to browser session) and a required `If-Match` on the collection `PATCH` (made required by CORE-11) (W11, owner decisions 2026-11-18).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/content/collections` | `/quan-tri/noi-dung/bo-suu-tap` | `/en/admin/content/collections` |
| `/admin/content/collections/[slug]` | `/quan-tri/noi-dung/bo-suu-tap/[slug]` | `/en/admin/content/collections/[slug]` |
| `/admin/content/integrity` | `/quan-tri/noi-dung/toan-ven` | `/en/admin/content/integrity` |

API routes that moved from token-only to `adminContentRoute(request, { action: 'content:write', session: true })`: `GET`/`POST /api/admin/travel/collections`, `GET`/`PATCH …/collections/[slug]` (`DELETE` stays token-only by owner decision), `POST …/collections/[slug]/status`, `GET /api/admin/travel/integrity`. `GET /api/admin/planner/integrity` now passes `{ action: 'user:provision', session: true }`. The service token keeps working on all of them. `templates/**` is untouched (CORE-5).

## Data

Reads and writes `DestinationCollection` (`title`, `tagline`, `description`, `cover`, `destinationSlugs`, `storySlugs`, `placeSlugs`, `seo`, `status`, `updatedAt`). The slug is the identity and is not edited. Integrity findings are `{ entity, id, issue }`; the Planner report carries identifiers and issue text only, never trip content (ADR 0002 §3). Message namespaces: `adminContent.collections`, `adminContent.integrity`, plus `adminContent.list.{search…,sort…,noMatches}` and `adminContent.nav.{collections,integrity}`.

## How it works

Both pages are server components behind `requireStaff(…, 'content')` (anonymous goes to sign-in, a member gets the admin 404). The integrity page passes `showPlanner = canUsers` (`user:provision`) to the client island, so editors never request the Planner report, and the API refuses them anyway. The list is `ContentList kind="collections"`: it fetches once, then searches (case and diacritic insensitive over slug and both titles) and sorts (recently updated, name, slug) with the pure helpers in `list-utils.ts`; the same search and sort now also serve stories and places. The editor is `RecordShell` with `CollectionEditor`: it saves with `If-Match: "<updatedAt>"`, and a stale save answers 412, shown as "someone else saved first" with a reload button. Status changes use the status endpoint. Findings link to the owning record (`ownerLink`): story, place and collection to their editor, review to the moderation queue; templates and Planner records are plain text. Empty, loading and error states are shown with a retry.

`updateCollection(slug, patch, expectedUpdatedAt?)` in the repository compares the stamp inside the transaction (one repository class serves the JSON and PostgreSQL stores). Since CORE-11 the route requires the header (a missing one is `428 precondition_required`), for API callers too.

## Files

| Path | Role |
|---|---|
| `src/app/api/admin/travel/collections/**`, `…/integrity/route.ts`, `src/app/api/admin/planner/integrity/route.ts` | guards moved to session access; collection PATCH passes `ifMatchStamp` |
| `src/server/content/repository.ts` | `updateCollection` `expectedUpdatedAt` (the route requires `If-Match`) |
| `src/app/(admin)/[locale]/admin/content/{collections,collections/[slug],integrity}/page.tsx` | pages |
| `src/components/admin/content/{collection-editor,integrity-report,list-utils,integrity-utils}.ts(x)`, `content-list.tsx`, `record-shell.tsx` | UI and pure helpers |
| `src/i18n/routing.ts`, `src/lib/admin-gate.ts`, `src/lib/return-to.ts`, `messages/*.json` | routes, sidebar, return-to, strings |

## Tests

`tests/admin-content-session.test.ts` — every moved handler: 401 with no credential, editor and admin 200, member 403, service token 200, cross-site mutation refused with nothing written, `If-Match` match / stale 412 / absent / empty 400 and a concurrent race, planner integrity (admin 200, editor and member 403). `tests/admin-collections-integrity.test.ts` — routes, sidebar, page gate and role matrix, search/sort helpers, finding links, message parity. `tests/dom/collections-integrity.test.tsx` — editor sends `If-Match`, shows the 412 notice and reloads, status POST, list search, integrity report for editor versus admin, error and retry. Not covered: a real browser run at 375/768/1280 (NOT RUN).

## Limits and open questions

No create or delete in the browser (the API supports both; ship them with the same confirm pattern as archive when needed). No automatic fixing of findings. Every editor session can now write collections, the same exposure as stories and places; `/sec-check` is recommended. The 30 per minute per-user limit is per process. `If-Match` is required on the API (CORE-11), so token callers cannot overwrite blindly.
