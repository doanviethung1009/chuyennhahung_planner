# Feature — Place publish status

🇻🇳 Bản tiếng Việt: [place-publish-status.vi.md](place-publish-status.vi.md)

## Summary

A place now has the same lifecycle as a story: `draft`, `published`, `archived`. An editor who creates a place in the admin gets a draft that visitors cannot see, and publishes it from the place's editor when it is ready. Decision: [ADR 0035](../adr/0035-place-publish-status.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/content/places` (status filter and badge) | `/quan-tri/noi-dung/dia-diem` | `/en/admin/content/places` |
| `/admin/content/places/[slug]` (publish / unpublish / archive buttons) | `/quan-tri/noi-dung/dia-diem/[slug]` | `/en/admin/content/places/[slug]` |
| `POST /api/admin/travel/places/[slug]/status` | same | same |

The public place routes are unchanged; they answer 404 for a place that is not published.

## Data

`Place.status` (`draft` | `published` | `archived`) and `Place.publishedAt` (`null` until first published). A stored place with no `status` is read as `published`. PostgreSQL: `content_places.status` (default `published`) and `published_at`, added by `db/migrations/0017_place_status.sql`. Message keys: `adminContent.create.placeNote` and `adminContent.errors.invalid_state` (VI and EN).

## How it works

`createPlace(input, { status })` defaults to `published`; the admin `POST` passes `draft`. `setPlaceStatus` publishes, unpublishes (back to `draft`) or archives, and refuses to take a place down while a published story shows it. `setStoryStatus('publish')` refuses while a place the story shows is not published. Public readers (`public-places.ts`, `public.ts`, `community/public.ts`, `GET /api/travel/places`) read only `published` places. The Planner refuses a new activity or review that points at a non-published place, but keeps existing ones. The admin editor reuses the story status controls (`RecordShell` with `lifecycle`).

## Files

| Path | Role |
|---|---|
| `src/server/content/schemas.ts` | `placeSchema.status`, `isPublishedPlace` |
| `src/server/content/repository.ts` | `createPlace` option, `getPublishedPlace`, `setPlaceStatus`, story publish guard |
| `src/app/api/admin/travel/places/[slug]/status/route.ts` | Status endpoint |
| `src/server/persistence/content-rows.ts`, `db/migrations/0017_place_status.sql` | PostgreSQL columns |
| `src/components/admin/content/place-editor.tsx`, `content-list.tsx` | Status controls and filter |

## Tests

`tests/place-status.test.ts`: default and draft creation, legacy place without status, list and public-read filtering, the lifecycle, and both story guards. `tests/travel-content-api.test.ts`: the admin `POST` returns a draft and the public route 404s until it is published. `tests/runbook.test.ts` checks the route is documented. Not covered: the editor buttons in a browser (no jsdom in this environment) and the PostgreSQL migration against a real database.

## Limits and open questions

Collections, templates and content reviews are not blocked from referencing a draft or archived place; public pages drop it silently. Status changes are not written to the audit log. Migration `0017` has not been applied to any database by this change.
