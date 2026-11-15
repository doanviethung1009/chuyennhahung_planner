# Feature — Community trips

🇻🇳 Bản tiếng Việt: [community-trips.vi.md](community-trips.vi.md)

## Summary

Travellers can ask for a public trip of theirs to appear on the home page and on a gallery page. Nothing is shown until a staff member approves it, any later change to the trip takes it down until it is approved again, and the author appears by display name or anonymously, as the owner chooses. This is PR 1 of [ADR 0014](../adr/0014-community-trips-and-reviews.md); traveller place reviews are PR 2.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/community-trips` | `/chuyen-di-cong-dong` | `/en/community-trips` |
| `/admin/community` | `/quan-tri/cong-dong` | `/en/admin/community` |

API: `PUT|DELETE /api/planner/[id]/listing` (owner), `GET /api/community/trips` (public), `GET /api/admin/community/queue` and `PATCH /api/admin/community/trips/[id]` (staff, action `community:moderate`).

## Data

- `Trip.listing` — `null` (not listed) or `{ status: pending | approved | rejected, authorDisplay: name | anonymous, requestedAt, decidedAt, decidedBy, rejectReason }`. Absent on older rows, which read as `null`.
- `CommunityTripCard` — the public allow-list: `shareToken`, `title`, `destinationSlug`, `durationDays`, `partySize`, `travelStyle`, `activityCount`, `author` (`null` when anonymous), `approvedAt`. Never email, user id or `ownerId`.
- PostgreSQL: migration `0005_trip_listing.sql` adds a nullable `trips.listing` JSONB column; rollback in `db/rollback/`.
- Message namespaces: `community`, `home.community`, `share.listing*`, `adminCommunity`, `adminContent.nav.community`, `nav.communityTrips`.
- **Owner data required:** `contribution.terms` (VI and EN) and `contribution.takedownContact` in `src/content/site.ts`. Both are `null` today and nothing is invented.

## How it works

1. The owner sets a trip to `public`, then in the share panel chooses how to appear and submits. The listing becomes `pending` (no version bump, no `If-Match`). The control is disabled with a neutral notice until the owner supplies the terms and the takedown contact.
2. Staff open `/quan-tri/cong-dong`: pending first, a link to the trip, **Approve**, **Reject** (reason required) or, on an approved one, **Remove** (reason required).
3. The home page and `/community-trips` read approved listings through `getCommunityTrips` (`src/server/community/public.ts`). A store failure gives an empty list, and an empty list hides the home section.
4. Any mutation of the trip (`touch`) turns an approved listing back to `pending`. Leaving `public`, un-sharing or archiving sets it to `null`. Rotating the share token keeps it and the gallery link follows the new token.
5. Titles and names are traveller-written and rendered as plain text.

## Files

| Path | Role |
|---|---|
| `src/server/planner/schemas.ts` | `tripListingSchema`, request/decision schemas, `CommunityTripCard`, `ListingQueueItem` |
| `src/server/planner/repository.ts` | `requestListing`, `withdrawListing`, `decideListing`, `listListingQueue`, `listCommunityTrips`, re-queue in `touch` |
| `src/server/identity/permissions.ts` | action `community:moderate` (editor, admin, service) |
| `src/server/persistence/planner-rows.ts`, `db/migrations/0005_trip_listing.sql` | PostgreSQL column |
| `src/app/api/planner/[id]/listing`, `src/app/api/community/trips`, `src/app/api/admin/community/**` | routes |
| `src/server/community/public.ts` | server-only read module for pages |
| `src/components/cards/community-trip-card.tsx`, `src/components/sections/community-trips-section.tsx` | public UI |
| `src/app/[locale]/community-trips/page.tsx` | gallery |
| `src/components/planner/share-panel.tsx` | owner control |
| `src/app/[locale]/admin/community/page.tsx`, `src/components/admin/community/listing-queue.tsx` | staff queue |
| `src/content/site.ts` | `contribution` (owner data) |

## Tests

`tests/community-trips.test.ts`: nothing public before approval; only public active trips can be submitted; rejected/pending/unlisted stay off the gallery; any edit re-queues; leaving public or archiving ends the listing; token rotation keeps it; remove and withdraw; another owner's trip is `not_found`; the card has exactly the allowed fields and anonymous hides the name, user id and trip id; request/decision schemas are strict. `tests/planner-roles.test.ts` pins `community:moderate`. `tests/planner-sharing.test.ts` classifies `listing` as withheld from the share view.

Not run here: the PostgreSQL integration test (no database in this environment), so the `listing` column is covered by the row-mapping unit tests only.

## Limits and open questions

- The feature is closed until the owner supplies the contribution terms and the takedown contact.
- No notification to staff or to the owner when a decision is made; the queue is polled by opening the page.
- Editing a listed trip always costs the listing; a text-only exception was considered and rejected by the owner.
- The gallery lists the newest 48 approvals; there is no search or paging.
- The gallery link carries the share token; that is acceptable only because a listed trip is public.
- Reporting by readers is not built. Traveller place reviews are a separate feature: [community-reviews.md](community-reviews.md).
