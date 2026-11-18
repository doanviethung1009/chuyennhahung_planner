# Feature — Admin itinerary templates (P07-6)

🇻🇳 Bản tiếng Việt: [admin-content-templates.vi.md](admin-content-templates.vi.md)

## Summary

Editors maintain itinerary templates in the browser — list, search, sort, edit the metadata (vi and en side by side), days and activities, reorder activities and move them between days — and read the frozen source snapshot and the derived figures. Until now this was `curl` only. Every write sends `If-Match`, so nobody silently overwrites a colleague. Trips already created from a template are frozen copies and never change (`tests/planner-clone-independence.test.ts`). No version history (owner decision W4).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/content/templates` | `/quan-tri/noi-dung/lich-trinh-mau` | `/en/admin/content/templates` |
| `/admin/content/templates/[slug]` | `/quan-tri/noi-dung/lich-trinh-mau/[slug]` | `/en/admin/content/templates/[slug]` |

API routes that moved from token-only to `adminContentRoute(request, { action: 'template:write', session: true })`: `GET /api/admin/travel/templates`, `GET`/`PATCH …/templates/[slug]`, `POST …/templates/[slug]/reorder`, `POST …/templates/[slug]/move-activity`. The service token keeps working. **`POST …/templates` (create) and `DELETE …/templates/[slug]` stay token-only** by owner decision (2026-11-19): creating from a story and permanent deletion are not editor actions. `PATCH`, `reorder` and `move-activity` honour an optional `If-Match: "<updatedAt>"` and answer 412 `version_conflict` on mismatch.

## Data

Reads and writes `TravelTemplate`: `title`, `summary`, `groupSize` (vi/en), `travelStyle`, `pace`, `itinerarySlugs`, `visibility`, `days[].{title, summary, activities[]}` with each activity's `title`, `placeSlug`, `startTime`, `durationMinutes`, `estimatedCostVnd`, `note`. Read-only: `slug`, `sourceStorySlug`, `sourceSnapshot` (immutable by design, ADR 0001 §4), `durationDays`, `placeSlugs`, `estimatedTotalVnd` and `version` (all derived). Message namespaces: `adminContent.templates`, `adminContent.nav.templates`, plus the shared `adminContent.list.*`.

## How it works

Both pages are server components behind `requireStaff(…, 'content')`; the list and the editor are client islands that call the existing endpoints. The list fetches once and searches and sorts with `list-utils.ts` (shared with stories, places and collections). The editor keeps a draft of the whole record. **Save** sends only the metadata keys that changed, and `days` only when activity content changed: a `days` patch re-issues activity ids, so ordering never goes through it. **Reorder (up/down)** and **move to another day** call `reorder` and `move-activity`, which keep activity ids; each saves at once and is disabled while there are unsaved edits (save first). A moved activity is appended to the target day; a day that holds one activity cannot give it up (the server refuses to leave a day empty). Publishing (`visibility: public`) needs the source story published: the server answers `invalid_state`, shown as a clear message. A 412 shows "someone else saved first" with a reload button. The source panel shows the snapshot and, when the source story's `updatedAt` is newer than `storyUpdatedAt`, a "source story changed" hint; if the story cannot be read the snapshot is still shown.

`updateTemplate`, `reorderActivities` and `moveActivity` in the repository take an optional `expectedUpdatedAt` checked inside the transaction (`checkStamp`); an absent header stays last-write-wins for API callers.

## Files

| Path | Role |
|---|---|
| `src/app/api/admin/travel/templates/**` | four handlers moved to session access; three pass `ifMatchStamp`; POST and DELETE unchanged in access |
| `src/server/content/repository.ts` | optional `expectedUpdatedAt` on the three methods |
| `src/app/(admin)/[locale]/admin/content/templates/{,[slug]/}page.tsx` | pages |
| `src/components/admin/content/{template-list,template-editor}.tsx`, `template-utils.ts` | UI and pure helpers |
| `src/i18n/routing.ts`, `src/lib/admin-gate.ts`, `src/lib/return-to.ts`, `messages/*.json` | routes, sidebar, return-to, strings |

## Tests

`tests/admin-content-session.test.ts` — the four handlers (401 / member 403 / editor, admin, super_admin and token allowed), cross-site mutation refused with nothing written, `If-Match` match / stale 412 / absent on `PATCH`, `reorder` and `move-activity`, and POST and DELETE refused for editor, admin and super_admin sessions while the token still deletes a private template and a public one stays blocked. `tests/travel-content-repository.test.ts` — the stamp on the three methods. `tests/admin-template-cms.test.ts` — routes, sidebar, page role matrix, patch building, stale-source check, ordering helpers, message parity. Not covered: a rendered-component test of the editor and a real browser run at 375/768/1280 (NOT RUN).

## Limits and open questions

No create (from a story), delete, or add/remove of days and activities in the browser; creating a template from a story is a separate decision. No version history (W4). Every editor session can now change public template content, the same exposure as stories and places; `/sec-check` is recommended. `If-Match` is optional on the API, so token callers can still overwrite. The 30 per minute per-user limit is per process.
