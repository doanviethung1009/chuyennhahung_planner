# ADR 0014 — Community trips and place reviews: opt-in, moderated, traveller-owned

🇻🇳 Bản tiếng Việt: [0014-community-trips-and-reviews.vi.md](0014-community-trips-and-reviews.vi.md)

- **Status:** Accepted — owner approved 2026-11-14; PR 1 (trip gallery, migration `0005_trip_listing.sql`) and PR 2 (reviews, migration `0006_community_reviews.sql`) implemented
- **Date:** 2026-11-14
- **Owner:** system-architect
- **Decided by:** owner (scope: gallery **and** place reviews; admin approves before anything goes live; author shown by display name with an anonymous option), system-architect (contract)
- **Affects:** `src/server/planner/**`, `src/server/identity/permissions.ts`, `src/server/persistence/planner-rows.ts` + a new migration, `src/app/api/community/**` (new), `src/app/api/admin/community/**` (new), the home page, two new public pages, one new admin page, `src/i18n/routing.ts`

## Context

[ADR 0005](0005-trip-sharing-and-story-cloning.md) shipped `public` trips as capability
links and deliberately **no gallery**: a public trip is indexable but nobody can find it.
The owner now wants the home page to show other travellers' trips next to Nhà Hưng's
own, and travellers to review places.

Two things are new in kind, not degree:

1. **Traveller-written text on the brand's front page.** Until now every public string
   was written by the owner or an editor. A trip's title and activity notes are free text.
2. **Reviews by someone other than the brand.** `TravelReview` (Travel Content, ADR 0001)
   is the brand voice, written under an admin principal and never tied to a user. A
   traveller review is a different thing: owned by a user, rate-limited, moderated.

Existing pieces to build on: the share projection `SharedTripView` (allow-list, ADR 0005),
the role/`can()` model (ADR 0006), the admin portal guard (ADR 0010/0011), the Planner's
two stores — JSON file and PostgreSQL (ADR 0009) — and `displayName` on `plannerUsers`.

What we do not know: expected volume (assumed small: tens of listings, hundreds of
reviews), and whether the owner wants edits to a listed trip to stay live. Both are
flagged under Follow-up.

## Decision

1. **Listing is a third, separate opt-in.** `visibility: 'public'` stays what it is — an
   indexable link. A trip appears on the home page and in the gallery only when its new
   `listing.status` is `approved`. `listing` is `{ status: 'none' | 'pending' | 'approved'
   | 'rejected', authorDisplay: 'name' | 'anonymous', requestedAt, decidedAt,
   decidedBy, rejectReason }`. Default `none`; rows without it read as `none` (no
   migration of existing data).
2. **Owner requests, staff decides.** `PUT /api/planner/[id]/listing` with
   `{ authorDisplay }` sets `pending`; it requires the trip to be `active` and
   `public`. `DELETE` returns it to `none`. Staff (`editor`, `admin`, the service
   principal) approve, reject (with a reason) or remove through
   `/api/admin/community/trips/[id]`, gated by one new action `community:moderate` in
   `ROLE_ACTIONS`. **Nothing reaches a public page without a staff decision.**
3. **Leaving `public` or being archived ends the listing at once** (`status → none`).
   Rotating the share token keeps the listing; the gallery link follows the new token.
4. **Any change to a listed trip sends it back to `pending`** and removes it from public
   pages until a staff member approves it again — owner-confirmed, no exceptions for
   "small" edits. Approval is a statement about the content that was reviewed. Cost: the
   owner loses their slot on every edit.
5. **Gallery projection is a new allow-list**, `CommunityTripCard`: `shareToken` (the
   public link), `title`, `destinationSlug`, `durationDays`, `partySize`, `travelStyle`,
   `activityCount`, `author` (`string | null`; `null` for anonymous — **never** the
   email, user id or `ownerId`). The detail page is the existing `/shared/[token]` view.
   A test enumerates the allowed fields, as ADR 0005 does for the share view.
6. **Community review is a new Planner-store entity**, `CommunityReview`: `id`,
   `source: 'planner' | 'homepage'`, `authorId` (`null` for a guest), `placeSlug` (must
   resolve to a published place), `rating` 1–5, `body` (≤ 1000 chars, plain text, rendered
   as text, never HTML), `lang` (`vi|en`), `visitedOn` (**required**, not in the future),
   `authorName` (display text; guests type one or stay "Guest"), `status: 'pending' |
   'approved' | 'rejected' | 'removed'`, moderation fields, timestamps. It lives **beside
   the trips**, not in Travel Content: that has one admin principal, no users.
7. **Both entry points publish at once (owner decision; amended 2026-11-15).** The
   owner first asked for Planner reviews to be moderated and guest reviews not; on
   2026-11-15 they asked for Planner authors to publish without waiting too. So **no
   review is pre-moderated**; staff can `remove` any live one.
   - **Written inside the Planner** (signed-in traveller, `source: 'planner'`): `approved`
     immediately, rate-limited to 5/hour/user. One per author per place; submitting again
     replaces it. Authors list and delete their own.
   - **Written on the home page by anyone** (`source: 'homepage'`): `approved` immediately,
     bounded by plain text only (links never clickable), 3/hour per client key, 20/day per
     place overall, a honeypot field, a 60–1000 char body, one guest review per place per
     client key per 24 h. The owner accepts the residual risk (spam and abuse stay visible
     until removed).
   - **Accurate information, no verified-visit requirement.** The place is picked from the
     catalogue, the visit date is required, and the review is shown as "self-reported",
     never "verified".
8. **Public reads** are `GET /api/community/trips` and `GET /api/community/reviews`
   (`?placeSlug=`), both returning only `approved` rows, read-only, rate-limited like
   `shareReadLimiter`. Average rating shown on a place counts approved reviews only and
   is hidden below 3 reviews, so one rating is not presented as consensus.
9. **Pages.** Home gets two sections ("Community trips", "Latest traveller reviews"),
   each hidden when empty — no empty shells and no fake seed data (CLAUDE.md rule 8).
   New pages: `/community-trips` (gallery) and the review list/form on place and
   destination pages. Admin: one queue page under the existing admin portal. Every string
   exists in VI and EN; user-written text is shown as written, in its `lang`.
10. **Storage.** Both Planner stores gain the new fields: JSON document keys
    `communityReviews` and trip `listing`; PostgreSQL migration `0005_trip_listing.sql`
    (PR 1) adds a nullable `listing` JSONB column on `trips`; PR 2 adds a `community_reviews` table,
    mirrored in `planner-rows.ts` and `planner-transfer.ts`. No foreign keys, matching
    ADR 0013. Reverting drops them; extra stored keys remain readable.
11. **Delivery in two PRs**, because the surfaces are independent: PR 1 trip gallery
    (decisions 1–5, 8 trips half, 9 trips half), PR 2 community reviews (6–7, 8 reviews
    half, 9 reviews half). PR 2 reuses the moderation queue and `community:moderate`.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) Separate `listing` opt-in + staff pre-moderation; reviews as a Planner-store entity | Matches the owner's choice; `public` links keep meaning; a user can share a link without being on the home page; no unreviewed traveller text on the front page | A moderation queue to staff; edits cost the slot; staff workload grows with volume |
| B List every `public` trip automatically | No new state, no queue | Contradicts the owner's "admin approves first"; spam and slurs reach the home page; a user who only wanted an indexable link is now showcased |
| C Post-moderation (live at once, staff can remove) | No wait for travellers | Abuse is visible until someone notices; owner explicitly chose approve-first |
| D Put community reviews into Travel Content | Reuses `TravelReview` and its admin UI | Wrong principal model (one admin token, no user), blurs the brand voice with strangers, and `TravelReview` carries brand-only fields |
| E Snapshot the trip at approval and show the snapshot | Approved text is exactly what is displayed; edits do not drop the listing | Second copy of trip data, stale content, more storage and a sync story |

Runner-up is E for trips; it lost on complexity for the expected volume — decision 4's
re-review is simpler and safe. Revisit if owners complain about edits dropping listings.

## Consequences

Easier: the home page can show real traveller content; `public` keeps its meaning;
moderation, roles and admin portal are reused; reviews attach to the existing place slugs.

Harder, and not free:

- **Someone has to moderate** trips; without staff the trip sections stay empty. All
  reviews go live unreviewed, so abuse there is cleaned up after the fact. No reporting button for readers (out of scope).
- **First user-generated content on the site.** Defamation, spam, personal data in
  notes and copyright are now possible; pre-moderation reduces but does not remove the
  risk, and takedown is staff-only. A terms/privacy statement for contributors is an
  owner task (see Follow-up).
- **Public author names** are personal data. Default must be the user's choice
  (`authorDisplay`), anonymous must really hide the name, and deleting an account or a
  trip must remove it from public pages.
- **Two moderation surfaces** (trips, reviews) on one queue and one new permission; a
  later `moderator` role stays a separate decision (ADR 0006).
- **Rating averages are small-sample.** Hidden below 3 reviews; no ranking by rating.
- **Schema change on both stores** plus import/export, so the migration needs the
  rollback note and a test through both stores.
- **Search/SEO surface grows**: approved listings and reviews are indexable; the sitemap
  gains `/community-trips`. Review text is never in structured data until volume justifies it.
- Reverting: remove the routes and sections; stored `listing` and `communityReviews`
  stay inert.

## Follow-up

- Contract and owner split: `.claude/contracts/community-trips-and-reviews.md`.
- On acceptance: update `docs/architecture.md` + `.vi.md` (routes, data, boundaries,
  phases) and `.claude/context/project-context.md`; feature documents
  `docs/features/community-trips.*` (PR 1) and `docs/features/community-reviews.*` (PR 2).
- **Owner answers (2026-11-14):** any edit to a listed trip re-queues it; Planner-written
  reviews and home-page guest reviews are both published without approval (amended
  2026-11-15); no verified-visit requirement
  but accurate structured data; terms and takedown contact — **owner to supply, not invented**.
- **Blocking gate for go-live:** the contribution terms text and the takedown contact are
  read from site configuration (`src/content/site.ts`, owner data). Until both are filled
  the "Show on home page" control and every review form render disabled with a neutral
  notice — no fake email, no placeholder link (CLAUDE.md rules 4 and 8).
- Open: confirm the guest-review limits above (3/hour per client key); say whether staff
  should be notified of new guest reviews.
- A reporting button, replies, likes, photo uploads, and a `moderator` role each need
  their own decision.
