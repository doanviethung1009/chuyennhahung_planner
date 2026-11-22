# Travel Content System — API reference

🇻🇳 Bản tiếng Việt: [travel-content-api.vi.md](travel-content-api.vi.md)

Five modules: **Travel Stories**, **Travel Places**, **Destination
Collections**, **Travel Reviews** and reusable **Travel Templates**.
Design rationale and the entity boundaries are in
[ADR 0001](adr/0001-travel-content-system.md). This file is the contract.

The AI Planner is **not** part of this phase, and no user-trip entity exists.

## Setup

```bash
# Required for every /api/admin/** route. Fails closed: no token, no admin API.
export ADMIN_API_TOKEN="$(openssl rand -hex 32)"

# Optional
export TRAVEL_CONTENT_STORE=.data/travel-content.json  # default
export TRAVEL_CONTENT_AUTOSEED=false                   # skip the demo seed
```

On first use an empty store is seeded with the demo content (six Đà Lạt places,
two reviews, one published story, one collection, one public template).

## Conventions

| Topic | Rule |
|---|---|
| Money | Every `*Vnd` field is a **non-negative integer count of đồng**. Never a float, never a minor unit. Max 10^12. |
| Localized text | `{ "vi": "…", "en": "…" }` — **both** required (CLAUDE.md rule 1). |
| Slugs | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, immutable after create. A URL is a promise. |
| Dates | `YYYY-MM-DD` for travel dates, ISO-8601 datetimes for timestamps. |
| Unknown keys | Stripped by the schema, never persisted. |
| Derived fields | `actualCostTotalVnd`, `durationDays`, `estimatedTotalVnd`, `placeSlugs`, `version`, `status`, `publishedAt` and `sourceSnapshot` are **server-owned**. Sending them has no effect. |
| Caching | Every response is `cache-control: no-store`. |

### Authorization

```
Authorization: Bearer <ADMIN_API_TOKEN>
```

Compared with `timingSafeEqual`. A token shorter than 32 characters is treated
as a misconfiguration, not a weak secret.

**Session access (ADR 0011).** Some routes also accept a browser session cookie (same-origin proof required on mutations): list `GET` of `stories`, `places`, `reviews`, and `GET` / `PATCH` of `stories/[slug]`, `places/[slug]`, `reviews/[id]` and `PATCH stories/[slug]/places` and, since P07-16, `POST stories` and `POST places` need the `content:write` action (`editor`, `admin`); `POST stories/[slug]/status` and `reviews/[id]/status` need `story:publish`. Since P07-15 (W11) `collections` (`GET`, `POST`), `collections/[slug]` (`GET`, `PATCH`; `DELETE` stays token-only), `collections/[slug]/status` and `integrity` also accept a session on `content:write` (same-origin proof on mutations, 30 per minute per user), and the Planner `GET /api/admin/planner/integrity` accepts an admin session on `user:provision` (editors are refused). Collection `PATCH` takes the same required `If-Match: "<updatedAt>"` as places (stale -> 412 `version_conflict`; absent -> 428). Since P07-6 `templates` (`GET`), `templates/[slug]` (`GET`, `PATCH`), `templates/[slug]/reorder` and `templates/[slug]/move-activity` accept a session on `template:write` (an editor action); `PATCH`, `reorder` and `move-activity` take the required `If-Match: "<updatedAt>"` (stale -> 412 `version_conflict`; absent -> 428). `POST templates` and `DELETE templates/[slug]` stay token-only (owner decision 2026-11-19). Since CORE-10 (ADR 0028) `DELETE places/[slug]` accepts an admin or super admin session on the new `content:delete` action (same-origin proof, 30 per minute per user; editors and members get 403), besides the token; the 409 `place_in_use` and 503 rules below apply to both. Everything else (`DELETE` of stories/reviews) stays token-only.

**Optimistic concurrency.** `PATCH` on those routes requires an `If-Match: "<updatedAt>"` header (the record's last `updatedAt`, quoted) since CORE-11, for sessions and the token alike. If the record changed since, the answer is **412** `version_conflict` and nothing is written. A missing header is **428** `precondition_required` (it used to be last-write-wins); an empty header is `400`.

### Error shape

```json
{ "error": { "code": "invalid_reference", "message": "…", "issues": [ { "path": "placeSlugs[0]", "message": "place \"x\" does not exist" } ] } }
```

| Code | Status | Meaning |
|---|---|---|
| `bad_request` | 400 | Body is not valid JSON |
| `unauthorized` | 401 | Missing or wrong bearer token |
| `payload_too_large` | 413 | Body exceeds 256 KiB — refused before it is parsed |
| `not_found` | 404 | No such record — also what an unpublished record returns publicly |
| `slug_conflict` | 409 | Slug or id already taken |
| `invalid_state` | 409 | Refused by a lifecycle rule (see *Invariants*) |
| `place_in_use` | 409 | A place cannot be deleted while content or Planner data references it; `error.details.counts` gives counts per kind |
| `validation_failed` | 422 | Schema rejected the payload; `issues` lists field paths |
| `invalid_reference` | 422 | Structurally valid but points at something absent |
| `admin_auth_unconfigured` | 503 | `ADMIN_API_TOKEN` unset or too short |

Reference problems are reported **all at once**, not one per round trip.

A request body is capped at **256 KiB** for every mutating endpoint, the Planner
included. `Content-Length` is checked first, but it is only a claim, so the body
is also measured as it streams in and the connection is cut the moment it goes
over. The limit is enforced *before* the payload is parsed or validated, which
is what keeps an oversized collection from reaching the validator at all.

## Public endpoints

Read-only. Serve published stories/collections/reviews and public templates
only; a draft is a 404.

| Method | Path |
|---|---|
| `GET` | `/api/travel/stories` · `/api/travel/stories/[slug]` |
| `GET` | `/api/travel/places` · `/api/travel/places/[slug]` |
| `GET` | `/api/travel/collections` · `/api/travel/collections/[slug]` |
| `GET` | `/api/travel/reviews` |
| `GET` | `/api/travel/templates` · `/api/travel/templates/[slug]` |

List query: `?destinationSlug=&category=&travelStyle=&limit=50&offset=0`.

`GET /api/travel/places` also takes an optional `q` (PLACES-UI-S6): free text, trimmed, 1–80 characters (longer or blank → 422 `validation_failed`). It matches `name` and `location` (Vietnamese and English) by a plain case- and diacritic-insensitive substring test (`đ` = `d`); the category label is not matched (use `category`). The term is data only — no regex, wildcard or `LIKE` pattern is built from it. Search runs before `limit`/`offset`. Omitting `q` changes nothing; the response shape (`places`, `count`) is unchanged; the other list endpoints ignore `q`. The match is an in-memory scan of the catalogue (6 seed places today); a store-side search is a future change if the catalogue grows past a few thousand places.
**Public shape (PLACES-API-PROJ).** Both places endpoints return the ADR 0026 allow-list, not the stored record: `slug`, `name`, `destinationSlug`, `location`, `category`, `images`, `description`, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`. `affiliateLinks`, `createdAt`, `updatedAt` and `coords` are **no longer returned** (breaking only for a client that read them; `/api/admin/travel/places*` still returns the full record). Envelope (`places`, `count`), `q`, `destinationSlug`, `category`, `limit`/`offset` and the 404 are unchanged.
Places carry no publish status — a place exists or it does not.

**Public story shape (STORY-API-PROJ).** Both story endpoints return an allow-list, not the stored record: `slug`, `title`, `excerpt`, `content`, `cover`, `gallery`, `destinationSlug`, `plannerTemplateSlug`, `travelDates`, `travelStyle`, `readingMinutes`, `seo`, `publishedAt`, `updatedAt` (`toPublicStoryRecord`). `status`, `createdAt`, `actualCost`, `actualCostTotalVnd`, `placeSlugs`, `reviewIds` and `itinerarySlugs` are not returned; the admin routes still serve the full record. This is a breaking change for any client that read those fields. `GET /api/travel/reviews` still returns the stored review (separate follow-up).

## Admin endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `/api/admin/travel/places` | List (incl. everything) · create |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/places/[slug]` | Read · update · delete |
| `GET` `POST` | `/api/admin/travel/stories` | List (incl. drafts) · create as draft |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/stories/[slug]` | Read · update · delete |
| `POST` | `/api/admin/travel/stories/[slug]/status` | `{"action":"publish"\|"unpublish"\|"archive"}` |
| `PATCH` | `/api/admin/travel/stories/[slug]/places` | `{"add":[],"remove":[]}` — add places to a story |
| `GET` `POST` | `/api/admin/travel/collections` | List · create |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/collections/[slug]` | Read · update · delete |
| `POST` | `/api/admin/travel/collections/[slug]/status` | Publish lifecycle |
| `GET` `POST` | `/api/admin/travel/reviews` | List · create |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/reviews/[id]` | Read · update · delete |
| `POST` | `/api/admin/travel/reviews/[id]/status` | Publish lifecycle |
| `GET` `POST` | `/api/admin/travel/templates` | List · **create from a real trip** |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/templates/[slug]` | Read · update · delete |
| `POST` | `/api/admin/travel/templates/[slug]/reorder` | `{"day":2,"activityIds":[…]}` — reorder within a day |
| `POST` | `/api/admin/travel/templates/[slug]/move-activity` | `{"activityId","toDay","toIndex"}` |
| `GET` | `/api/admin/travel/integrity` | Referential sweep over the whole store |

A story is **always created as a draft**. Publishing is a separate, explicit call.

## Invariants the API enforces

**References** — a place must belong to an existing `Destination`; a story's
`placeSlugs`, `reviewIds` and `itinerarySlugs` must all resolve; a review's
subject must resolve for its `kind`; a template's `sourceStorySlug` and every
activity `placeSlug` must exist. A place embedded in story body content must
also appear in `placeSlugs`, so the two can never disagree.

**Publishing** — a story cannot be published while a linked review is still a
draft (a live page must not link to a hidden one). A collection cannot be
published while it holds an unpublished story. A template cannot be public
unless its source story is published.

**Taking things down** — a published story or collection cannot be deleted
(unpublish or archive first) so a live URL cannot start 404-ing. A review cannot
be unpublished while a published story links it. A public template cannot be
deleted. A place cannot be deleted while anything references it: `DELETE
/api/admin/travel/places/[slug]` answers **409 `place_in_use`** with
`error.details.counts` = `{ stories, collections, templates, contentReviews,
tripActivities, communityReviews }` (counts only: no user, trip or review id). The
Planner counts cover every activity (archived trips too) and every community
review whatever its status. Nothing is cascaded or rewritten; archive or replace
the references, or keep the place. If the Planner store cannot be read the answer
is 503 `service_unavailable` and nothing is deleted. The content and Planner
checks are not one transaction when the stores are separate, so a trip adding the
place in between is possible; `GET /api/admin/planner/integrity` ("unknown place")
is the backstop. A place cannot be unlinked from a story while still
embedded in its body.

**Templates** — days are numbered `1..n` and activity `order` runs `0..m` by
construction, never by input. `durationDays`, `estimatedTotalVnd` and
`placeSlugs` are derived on every write. `version` increments on every
structural mutation. A day cannot be left with zero activities.

**`sourceSnapshot` is immutable.** It freezes the source story's title,
destination, travel dates, cost total and place slugs at creation. Editing *or
deleting* the source story never mutates it — a deleted source is reported by
the integrity sweep as information, not corruption. A patch cannot overwrite it.

> Replacing `days` wholesale **re-issues activity ids**. Use `reorder` and
> `move-activity` for ordering changes; they preserve ids.

## Worked example

```bash
T="Authorization: Bearer $ADMIN_API_TOKEN"
J="content-type: application/json"

# 1. A place
curl -X POST localhost:3000/api/admin/travel/places -H "$T" -H "$J" -d '{
  "slug":"ho-tuyen-lam","destinationSlug":"da-lat","category":"nature",
  "name":{"vi":"Hồ Tuyền Lâm","en":"Tuyền Lâm Lake"},
  "location":{"vi":"Phường 4","en":"Ward 4"},
  "coords":{"lat":11.8942,"lng":108.4192},
  "description":{"vi":["Hồ giữa rừng thông."],"en":["A lake in the pines."]},
  "suggestedMinutes":120,"estimatedCostVnd":80000,"rating":5 }'

# 2. Publish a story, then cut a public template from it
curl -X POST localhost:3000/api/admin/travel/stories/my-story/status \
  -H "$T" -H "$J" -d '{"action":"publish"}'

# 3. Reorder day 2 (If-Match is required: the template's current updatedAt, quoted)
curl -X POST localhost:3000/api/admin/travel/templates/my-template/reorder \
  -H "$T" -H "$J" -H 'If-Match: "<updatedAt>"' -d '{"day":2,"activityIds":["act_b","act_a"]}'

# 4. Check referential health
curl localhost:3000/api/admin/travel/integrity -H "$T"
```

## Tests

| File | Covers |
|---|---|
| `tests/travel-content-schemas.test.ts` | Integer-VND rejection of floats, both-locale enforcement, slug/date/image/rating rules, unknown-key stripping |
| `tests/travel-content-auth.test.ts` | Fail-closed behaviour, wrong/prefix/long tokens, scheme handling |
| `tests/travel-content-repository.test.ts` | CRUD, every invariant above, snapshot immutability, versioning, reorder/move, overlapping writes |
| `tests/travel-content-api.test.ts` | Real route handlers: status-code mapping, 401 without a token, `no-store`, persistence across instances |
| `tests/travel-content-acceptance.test.ts` | The brief's Đà Lạt acceptance scenario |
