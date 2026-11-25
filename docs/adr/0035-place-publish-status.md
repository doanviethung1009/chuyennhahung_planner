# ADR 0035 — A place has a publish status; the CMS creates drafts

🇻🇳 Bản tiếng Việt: [0035-place-publish-status.vi.md](0035-place-publish-status.vi.md)

- **Status:** Proposed
- **Date:** 2026-11-25
- **Owner:** system-architect
- **Affects:** `src/server/content/schemas.ts` (`placeSchema`, `isPublishedPlace`), `src/server/content/repository.ts`, `src/server/content/public-places.ts`, `src/server/content/public.ts`, `src/server/community/public.ts`, `src/server/planner/repository.ts`, `src/server/persistence/content-rows.ts`, `db/migrations/0017_place_status.sql`, `src/app/api/travel/places/**`, `src/app/api/admin/travel/places/**`, `src/components/admin/content/**`, `docs/features/place-publish-status.*`

## Context

Stories, collections and reviews have a `status` (`draft` → `published` → `archived`). A place did not: [ADR 0011](0011-admin-content-cms.md) (P07-16) and [ADR 0026](0026-public-places-routes.md) recorded that "a created place is public immediately". The admin form only warned about it. A typo or a half-written place therefore reached visitors, the sitemap, the review picker and the Planner catalogue the moment it was saved, and a story could not be reviewed in draft the way a place could not.

## Decision

1. **`Place` gains `status` (`draft` | `published` | `archived`) and `publishedAt`**, the same vocabulary as a story. A stored place without a `status` is read as `published`, so no existing place disappears.
2. **The admin `POST` creates a draft.** `createPlace(input, { status })` keeps `published` as its default so seeds and in-process callers are unchanged; only `POST /api/admin/travel/places` passes `draft`.
3. **`POST /api/admin/travel/places/[slug]/status`** (`publish` | `unpublish` | `archive`) moves it, under the existing `story:publish` action (same holders as a story's publish, per ADR 0011).
4. **Only `published` places are public:** `/places`, `/places/[slug]`, the destination page, the sitemap, `GET /api/travel/places[/slug]` (a `status` query from the caller is ignored), the places embedded in a story, and the review picker. A draft or archived place answers 404 on the public routes. Admin routes see every status.
5. **The Planner treats a non-published place as absent for new references** (adding an activity, a place review). Existing trip activities that point at a place later unpublished stay and are not reported as missing: the integrity report and staff lists still resolve it.
6. **Referential guards, in the content repository.** Taking a place down (`unpublish`/`archive`) is refused with `invalid_state` while a *published story* shows it (related list or place block). Publishing a story is refused while a place it shows is not published. Collections, templates and content reviews are not guarded in this decision.
7. **PostgreSQL:** migration `0017_place_status.sql` adds `status text NOT NULL DEFAULT 'published'` and `published_at`. Additive; every existing row becomes `published`. Rollback script in `db/rollback/`.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): reuse the story status vocabulary on `Place` | One mental model; the editor's existing status controls and badge are reused | Touches every public read path; needs a column |
| B: a boolean `isPublic` | Smaller | A second vocabulary; no archived state; the UI would diverge |
| C: confirmation dialog before create, no state | No schema change | A saved place is still public; no way to prepare a place in advance |

## Consequences

Easier: an editor can prepare a place and publish when it is ready; a mistaken place can be taken down without deleting it.

Harder:

- Every new public read of places must use `getPublishedPlace` or `status: 'published'`; a raw `listPlaces()` leaks drafts. `tests/place-status.test.ts` covers the current readers.
- A story, collection or template that already shows a place which is later archived is only guarded for published **stories**. Collections, templates and content reviews keep a dangling reference and the public pages drop it silently.
- The default of `createPlace` is `published`, so a future caller that forgets the option publishes at once. The CMS route is the only authoring entry today.
- Status changes on a place are not written to the audit log (the `audit_events` target kinds do not include `place`).

## Follow-up

- Add `place` to the audit target kinds and log status changes.
- Decide whether collections and templates should also block taking a place down.
- Rollback: `db/rollback/0017_place_status.sql` is destructive (drafts become visible to older code); publish or delete drafts first.
