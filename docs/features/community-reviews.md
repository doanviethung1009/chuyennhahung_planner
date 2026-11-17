# Feature — Community place reviews

🇻🇳 Bản tiếng Việt: [community-reviews.vi.md](community-reviews.vi.md)

## Summary

Travellers can review catalogue places, signed in inside the Planner or as a visitor on the home page. Every review goes live at once; there is no pre-moderation, and staff can remove one afterwards. Reviews show on the home page and on the destination page, always labelled self-reported. This is PR 2 of [ADR 0014](../adr/0014-community-trips-and-reviews.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| none new (shown on `/`, `/destinations/[slug]`, `/my-trips/[id]`, `/admin/community`) | | |

API: `GET /api/planner/reviews`, `PUT|DELETE /api/planner/reviews/[placeSlug]` (signed in), `GET|POST /api/community/reviews` (public), `GET /api/admin/community/reviews` and `PATCH /api/admin/community/reviews/[id]` (staff, `community:moderate`), `POST /api/admin/community/reviews/[id]/erase` (admin and up, `community:erase`).

## Data

- `CommunityReview` in the Planner store: `source` (`planner` | `homepage`), `authorId` (null for a guest), `placeSlug` (must be a catalogue place), `rating` 1–5, `body` 60–1000 plain-text characters, `lang`, `visitedOn` (required, not in the future), `authorName` (`null` = anonymous), `status` (`approved`, `removed` or `held`; `pending`/`rejected` exist only for rows from before this decision), `guestKey` (hash, dedupe only), moderation fields.
- PostgreSQL: migration `0006_community_reviews.sql` adds the `community_reviews` table (no foreign keys); `0007_review_hold.sql` adds `held` to its status check; `0008_review_restrictions.sql` adds the `review_restrictions` table; rollbacks in `db/rollback/`.
- Public output `PublicCommunityReview`: `placeSlug`, `rating`, `body`, `lang`, `visitedOn`, `author`, `createdAt` only. No id, author id, guest key, source or moderation field.
- The average is shown only from 3 approved reviews.
- Message namespaces: `communityReviews`, `adminCommunity.reviews`, `adminCommunity.tripsHeading|reviewsHeading`.
- **Owner data required:** the same `contribution` values as community trips; until set, every review form is closed.

## How it works

1. **Planner path:** on `/my-trips/[id]` a panel lists the catalogue places in the trip. The author writes or edits a review (`PUT`, rate-limited to 5/hour/user); it is `approved` at once, one per author per place, and an edit replaces it in place. The author can delete their own; staff can **Remove** it.
2. **Home page path:** anyone can post from the home page without an account. It is `approved` immediately. Bounds instead of pre-moderation: 10 per hour per client (owner decision 2026-11-17; was 3, and the one-per-place-per-24-hours rule was dropped), 20 per place per day overall, a hidden honeypot field (a filled one is dropped with a normal-looking 201), and plain text only. Staff can only **Remove** it.
3. **Ask the author** ([ADR 0015](../adr/0015-community-review-author-controls.md), PR 1): on a live Planner review staff choose **Ask the author** and write a question (`PATCH …/reviews/[id]` with `{ decision: 'hold', reason }`). The review is `held`: hidden from every public read and the average, and the author sees the question in the Planner reviews panel. Editing the review answers it and republishes it at once (question cleared); the author can also delete it. Staff can still **Remove** a held review, and then the author cannot overwrite it. A guest review cannot be held. There is no email: the author sees the question only when they open the trip page.
4. **Switch off an author** ([ADR 0015](../adr/0015-community-review-author-controls.md), PR 2): admin and service (`community:restrict`, not editors) choose **Switch off author** on a review and give a reason, for that place or for every place (`POST /api/admin/community/restrictions`, `{ reviewId, scope: 'place' | 'all', reason }`; the server derives the author from the review, staff never see an id or key). While it is active the author's new reviews are refused (403) and their existing reviews in scope are hidden at read time and from the average; nothing stored changes, so **Lift** (`DELETE …/restrictions/[id]`) restores them. A removed review stays removed. The author sees the reason and scope in their panel and cannot open the form there. Rows are never deleted, so the list is the audit trail (who, when, why, lifted by). A staff account cannot be switched off. A guest is switched off by the hash of the connection key, for the review's place only: it lasts 30 days by default and at most 90, and it is refused for the shared `unknown` key; the visitor is told reviews from this connection are paused. Deleting an account ends its restrictions (lifted by "account deleted") but keeps the rows as the record.
5. The place is picked from the catalogue and the visit date is required, so the details are checkable; the review is shown as "self-reported", never "verified".
6. Review text is rendered as text by React: HTML is inert and links are not clickable.
7. Deleting a user account deletes their reviews.
8. Pages read through `getApprovedReviews` and `getReviewPlaces` (`src/server/community/public.ts`); a store failure shows nothing rather than an error.

## Files

| Path | Role |
|---|---|
| `src/server/planner/schemas.ts` | `communityReviewSchema`, input and decision schemas, public/queue/own types |
| `src/server/planner/repository.ts` | `upsertPlannerReview`, `listOwnReviews`, `deleteOwnReview`, `createGuestReview`, `listApprovedReviews`, `listReviewQueue`, `createRestriction`, `liftRestriction`, `listRestrictions`, `listOwnRestrictions`, `decideReview` (incl. `hold`) |
| `src/server/rate-limit.ts` | `plannerReviewLimiter`, `guestReviewLimiter` |
| `src/server/persistence/planner-rows.ts`, `planner-transfer.ts`, `src/server/planner/store.ts`, `db/migrations/0006_community_reviews.sql` | storage |
| `src/app/api/planner/reviews/**`, `src/app/api/community/reviews/route.ts`, `src/app/api/admin/community/reviews/**` | routes |
| `src/components/reviews/*` | list, form, Planner panel |
| `src/components/sections/community-reviews-section.tsx` | home section |
| `src/components/admin/community/review-queue.tsx` | staff queue |

## Tests

`tests/community-reviews.test.ts`: Planner reviews are live at once and removable by staff; one per author per place and an edit replaces it; own delete only; unknown place and future date refused; removed with the account; guest reviews are public at once, only removable; one per client per 24 h; 20 per place per day; the address is never stored; the public projection names exactly the allowed fields; the average is hidden below three; a held review is hidden, shows the author its question, is republished by an edit, can be removed or deleted, and a guest review cannot be held; restrictions block and hide for one place or all, lift restores, never touch another author, time-box and refuse the shared guest key, leave out ids and keys, vanish with the account (`tests/review-restrictions-routes.test.ts` covers who may restrict and lift, cross-site refusal and strict bodies); schemas are strict and HTML stays inert. `tests/guest-review-erasure-cases.ts` (memory in `tests/guest-review-erasure.test.ts`, PostgreSQL in the integration file) and the route test cover the erasure: fields anonymised, content and key absent from the store and the export, one event, idempotent, failure writes nothing, Planner review refused, open report still resolves, the daily cap still counts the row; the route test pins 401/403 (member, editor, cross-site)/422/404/409/200 (admin, service token). `tests/planner-pg-fixtures.ts` now writes one review of each kind, so the row-mapping test and the PostgreSQL integration test cover the new table.

Not run here: the PostgreSQL integration test (no database in this environment).

## Limits and open questions

- **Place names in admin (2026-11-17).** The review queue and the restriction list show the place's name (VI/EN by admin locale) linked to its public destination page (`/destinations/[slug]`, new tab) instead of the raw slug. `listReviewQueue`/`listRestrictions` add `place: {name, destinationSlug} | null` from the catalogue (one lookup per distinct slug, no browser N+1); a slug the catalogue does not know shows as the slug. The public projection is unchanged.
- **Guest limit warning (2026-11-17).** When a guest hits the 10/hour limit the route answers `429` and records one `guest_limit` audit event (actor `system`) on that guest's latest review, at most once per hour. It carries no key or address. Staff read it with `GET /api/admin/community/events?targetId=<review id>`; the admin review queue now shows it too: `listReviewQueue` adds `guestLimitAt` (the latest `guest_limit` event time on that review, no key or address), rendered as a "Guest limit reached" badge with the time. No email or push notice exists. A guest who has no stored review (every attempt failed validation) leaves no event.
- **Guest review erasure (ADR 0024 §8, 2026-11-17).** On a data-removal request received at the takedown mailbox (`contribution.takedownContact`) an **admin** (action `community:erase`; not editor) opens the review in the queue and presses "Erase content", which calls `POST /api/admin/community/reviews/[id]/erase` `{reason}` (3–500 characters; a ticket or mail reference, not the requester's personal data — the UI warns). The row is **anonymised in place, irreversibly**: body → a fixed notice, `authorName`, `guestKey` and `rejectReason` → `null`, `visitedOn` → the creation date, `rating` → 1, status `removed`; `id`, `placeSlug`, `lang`, `createdAt` stay so the audit log, open reports and the 20-per-place-per-day cap keep working. Only guest (`homepage`) reviews, from any status (a plain remove keeps the text); a Planner review is `409 invalid_state` (account delete and author delete cover it). One `erase` audit event, same transaction; a second call is a no-op. There is no restore. Earlier audit events on the review stay (append-only) and hold staff reason text only. The same transaction clears `note` (a reporter's free text, which may quote the review) on **every** report of this review, open or handled, and a repeat call still clears a leftover note; the report rows and their reasons stay. The original star is overwritten with 1 and a `removed` review is not in the average. Open reports on it can still be resolved; restrictions made from it keep their own key until they end. No migration; same code on JSON and PostgreSQL. Not covered: backups, PostgreSQL's old row versions and WAL until vacuum/rotation, nginx logs, and the privacy-policy page (owner).
- **Guest key privacy (ADR 0024, batch 10.6b).** `guestKey` is `HMAC-SHA256(GUEST_KEY_SECRET, client key)` cut to 32 hex (no unsalted hash of an address remains) and is set to `null` 30 days after the review (the review text stays) by a batched sweep inside later write transactions. A guest restriction lasts at most **30 days** (default 30; was 90) and loses its key when it ends — expired (`liftedBy` = `key expired`) or lifted. Migration `0014` cleared every earlier key and ended active guest restrictions (`privacy migration`); not recoverable. Without the secret `POST /api/community/reviews` is `503` and stores nothing. Rotating the secret resets bans and the 24 h de-duplication. A review older than 30 days can no longer be turned into a guest restriction (no key). Staff erasure of a guest review on request is described above.
- Closed until the owner supplies the terms and the takedown contact.
- **Gate enforced by the API (batch 10.6a, P10-15).** While `contributionOpen` is false the three write routes (listing request, Planner review `PUT`, guest `POST`) answer `403 forbidden`, reason `contribution_closed`, before the limiter or the body is touched; reads and reports stay open. Helper: `src/server/community/contribution-gate.ts`. Tests: `tests/community-hardening.test.ts` (the flag is switched by mocking `site.ts`; the real file is not edited).
- **Guest `authorName` (P10-16).** Names that read as the site or staff (admin, quản trị, ban biên tập, nhân viên, staff, moderator, support, "Chuyện Nhà Hưng"…) are refused, case- and diacritic-insensitive, as `422 validation_failed` at path `authorName` (this API maps `validation_failed` to 422). One list: `src/server/community/reserved-names.ts`. "Hưng" alone is an ordinary name and is allowed. The Planner `authorDisplay` is not filtered (members are signed in and traceable); say so if the owner wants it covered.
- **Proxy key (P10-12).** `clientKey` takes the first `x-forwarded-for` hop. Behind the repo's nginx configs (`X-Forwarded-For $remote_addr`, overwrite, pinned in `tests/deploy-config.test.ts`) a forged header cannot choose the key; reaching the app without that proxy it can. `tests/community-hardening.test.ts` pins both. Checking the real VM config and the Cloudflare Tunnel is the owner's (D10) and **remains open**.
- **Global hourly cap for guest reviews: decided not to add.** Per-client 10/h and per-place 20/day already exist; a global cap would let one abuser lock out every honest visitor (denial of service) while a distributed abuser is not stopped by it either. Revisit if staff see floods across many places.
- Reviews are unmoderated by the owner's choice (both entry points): abuse stays visible until staff remove it, and the per-client limits rest on a forwardable header. Behind no trusted proxy every client shares one key, so only one guest review per place per day gets through.
- A Planner author's name is a snapshot taken when they submit; renaming the account does not change it.
- A muted account can open a second one; a guest restriction rests on a forgeable, sometimes shared key and so expires. A held question reaches the author only when they open the trip page (no email). Restrictions are held in memory per request at the current volume.
- No reporting button, replies, likes, photos or verified-visit badge. No notification to staff about new reviews.
- The home page shows the latest 3 reviews and the destination page 6; there is no dedicated list page or paging yet.
