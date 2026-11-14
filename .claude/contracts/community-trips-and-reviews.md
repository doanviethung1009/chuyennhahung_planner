# Task Contract: community-trips-and-reviews — Community trips on the home page + traveller place reviews
- Class: XL (first user-generated content on the site; new public read surface; schema change on both stores; new permission)
- Desired outcome / user impact: the home page and a gallery show other travellers' trips, and travellers can review places — nothing public until staff approve; authors may stay anonymous.
- Scope IN / OUT:
  - IN: `listing` state on trips; owner request/withdraw; staff approve/reject/remove; `CommunityTripCard` projection; `/community-trips`; home sections (hidden when empty); `CommunityReview` entity with two sources (Planner → moderated; home/guest → published at once, removable by staff), public approved list, rating average (≥3 reviews); one admin queue; both stores + migration; VI/EN strings; docs.
  - OUT: report button, replies, likes, photo upload, `moderator` role, verified-visit badge (reviews are labelled self-reported), search/ranking, email notifications, third-party scripts on any new page.
- Evidence (existing files, APIs, models): ADR 0005 (`SharedTripView`, `getSharedTrip`, share lifecycle), ADR 0006 (`can`, `ROLE_ACTIONS`), ADR 0009/0013 (stores, `planner-rows.ts`, migrations `0001–0004`), ADR 0010/0011 (admin guard, `adminContentRoute`), `src/server/rate-limit.ts`, `src/content/types.ts` (`VideoReview` is NOT this), Travel Content `TravelReview` (brand voice — untouched).
- Constraints / dependencies: **go-live gate** — contribution terms + takedown contact come from `src/content/site.ts` (owner data); until both exist the listing control and review forms render disabled with a neutral notice, no placeholder contact; Vietnamese-first, tokens only in `globals.css`, no placeholder links, a11y rules; no fake seed reviews/trips (rule 8); public pages must not import repository/store (`tests/client-boundary.test.ts`) — add a server-only read module like `getPublicContent`; no foreign keys.
- Architecture decision / ADR (if needed): [ADR 0014](../../docs/adr/0014-community-trips-and-reviews.md) — **Proposed; owner must accept before code.**
- Interface contract (API, types, DB):
  - `PUT|DELETE /api/planner/[id]/listing` (owner; `{authorDisplay:'name'|'anonymous'}`; 409 unless trip is active + public; no `If-Match`, no version bump; idempotent)
  - `GET /api/community/trips` → `{ items: CommunityTripCard[] }`; `GET /api/community/reviews?placeSlug=` → approved only
  - `POST /api/planner/reviews`, `PUT|DELETE /api/planner/reviews/[placeSlug]` (own review; session; `source:'planner'` → `pending`)
  - `POST /api/community/reviews` (guest, no session; `source:'homepage'` → `approved`; honeypot, 3/h per client key, 1 per place per key per 24 h, 20/day per place; `visitedOn` required; plain text 60–1000)
  - `GET /api/admin/community/queue`, `PATCH /api/admin/community/{trips|reviews}/[id]` `{decision:'approve'|'reject'|'remove', reason?}` (reviews from the homepage can only be `remove`d); action `community:moderate` (editor, admin, service)
  - Types: `TripListing`, `CommunityTripCard`, `CommunityReview` in `src/server/planner/schemas.ts`; migration `db/migrations/0005_community.sql` (`community_reviews` table, `planner_trips.listing` JSONB); JSON keys `communityReviews`, trip `listing`
  - Error taxonomy reused; identical 404 for any non-approved row on public reads.
- Tasks by owner:
  - Architect: ADR 0014 accepted; docs/architecture + project-context updates.
  - BE (PR 1): permissions action, schemas, repository (listing lifecycle, edit → pending, leave public/archive → none), store rows + migration, routes, projection + test enumerating fields, read module.
  - FE (PR 1): gallery page, home section, owner "Show on home page" control in trip editor share panel, admin queue page, routing + sitemap, messages VI/EN.
  - BE (PR 2): `CommunityReview` repository/rows/routes/limiter, rating aggregate.
  - FE (PR 2): review list + form on place/destination pages, home strip, admin queue tab, messages VI/EN.
  - QC / Security: **NOT RUN** until user calls `/qc-check` / `/sec-check`; both **recommended** (UGC, new public read, personal data in author names).
  - Git: main session, after approval only.
- File ownership (avoid parallel overlap): BE owns `src/server/**`, `src/app/api/**`, `db/migrations/**`; FE owns `src/app/[locale]/**`, `src/components/**`, `messages/*.json`; shared `schemas.ts` settled first by BE. One writer per file; no subagents unless the owner approves.
- Acceptance criteria / tests:
  1. A `public` trip with listing `none|pending|rejected` never appears in `/api/community/trips`, the gallery or the home page.
  2. Approve → appears; edit content → `pending` and disappears; leave `public` or archive → `none`.
  3. Projection test enumerates exactly the allowed card fields; anonymous → `author: null`; no email/id/ownerId anywhere in output.
  4. Non-staff `member` gets 403 on moderation; editor/admin/service pass (`can` matrix test).
  5. Review: one per (author, place); second submit replaces and goes `pending`; unknown `placeSlug` → 422; body > 1000 → 422; HTML is stored and rendered as plain text; 6th submit/hour → 429.
  6. Rating average hidden under 3 approved reviews; pending/rejected excluded.
  7. Same behaviour through JSON store and PostgreSQL store (parity test; migration applied on an empty and on an existing DB).
  8. Empty state: home sections absent, no empty shells; VI/EN parity (`tests/i18n.test.ts`); docs tests pass.
  9. `typecheck`, `lint`, `test` pass with output stated.
- Security and migration risks: UGC (XSS — render as text only, no `dangerouslySetInnerHTML`; defamation/spam — pre-moderation); author name is personal data (anonymous must hide it; account/trip deletion removes public rows); share token appears in gallery links — acceptable only because the trip is `public`, never include tokens of non-public trips; rate limits per user and per IP; additive migration only; existing rows read as `listing: none`.
- Rollback approach: remove routes/sections; additive columns/keys stay inert; `DROP TABLE community_reviews` + drop column is the only destructive step and is manual.
- Budget: 0 subagents by default; stop condition = owner accepts ADR 0014 and answers open questions 1–4; then PR 1 first, PR 2 after PR 1 merges.
- State: DESIGNED (awaiting owner approval at the ADR boundary)
- Feature document owner (`docs/features/<slug>.md` + `.vi.md`, CLAUDE.md rules 11–12): `community-trips` (PR 1), `community-reviews` (PR 2) — whoever ships the change.
- Architecture/usage doc updates needed (`docs/architecture.*`, `docs/usage.*`, rule 10): architecture (routes, data, boundaries, phases) and usage (how moderation is done) — on acceptance, in the same PRs.
