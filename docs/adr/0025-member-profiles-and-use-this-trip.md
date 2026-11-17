# ADR 0025 — Member profiles and "Use this trip" (Phase 11): private-by-default profiles, a per-trip copy switch, an allow-list copy with `origin`

🇻🇳 Bản tiếng Việt: [0025-member-profiles-and-use-this-trip.vi.md](0025-member-profiles-and-use-this-trip.vi.md)

- **Status:** Proposed
- **Date:** 2026-11-17
- **Owner:** system-architect
- **Affects:** new `src/server/community/profiles.ts` and a copy method in `src/server/planner/repository.ts` (next to `duplicateTrip`), `src/server/planner/schemas.ts` (`tripListingSchema`, `tripSchema`, a profile schema, an `origin` schema), `src/server/community/events.ts` (new actions), `src/server/persistence/planner-rows.ts` and `planner-transfer.ts`, migrations `0015` and `0016`, new routes under `src/app/api/planner/profile` and `src/app/api/community/**`, `deleteUser`. `src/server/identity/permissions.ts` and `src/server/community/submission.ts` are **not** changed. Refines, does not edit, [ADR 0014](0014-community-trips-and-reviews.md), [ADR 0015](0015-community-review-author-controls.md), [ADR 0019](0019-community-foundation.md) and [ADR 0024](0024-guest-identity-privacy.md).
- **Part of:** Phase 11 (backlog P11-1 and P11-3; P11-2 and P11-4 are the implementation); owner decisions P11-D1 and P11-D2; risk RK16 in [specs-community-roadmap.md](../specs-community-roadmap.md).

## Context

Phase 10 is merged: an audit log, an async PostgreSQL limiter, Creator Terms acceptance by version (`requireTermsAccepted`, `src/server/planner/repository.ts:1580`), reports, an HMAC guest key (ADR 0024) and staff erasure of a guest review. Phase 11 adds two things members see: **a profile** and **"Use this trip"** (copy a published community trip into one's own private draft).

Facts from the code:

1. **Author name is a per-item choice today.** `authorDisplaySchema = name | anonymous` (`schemas.ts:71`) is stored on the trip's `listing` (`schemas.ts:77-88`) and chosen in `requestListing` (`repository.ts:1598`). The gallery card has `author: string | null` and nothing else about the person (`schemas.ts:708-723`). Reviews copy `displayName` into `authorName` **at write time** (`repository.ts:1769`), so a review keeps the old name after a rename; the gallery author reads the user row. No profile entity exists.
2. **A trip has no owner-facing "copy by others" notion.** `duplicateTrip` (`repository.ts:1403`) copies one's **own** trip (`requireOwnedTrip`) with every row, including free-text notes and expenses, and sets `duplicatedFromTripId`. `Trip` has `listing`, `shareToken`, `visibility`, `note`, `budget` (`schemas.ts:311-343`); nothing records where a trip came from across users.
3. **Creator Terms already grant copying, conditionally.** Article 3 "Quyền sao chép và tùy chỉnh Planner" (`src/content/site.ts:68-74` VI, `:91-97` EN; version `termsVersion = '2026-11-16'`, `:113`) applies "when the creator turns on copying": another user may create a copy in their own account (1), the copy does not change the original (2), the user may edit it for personal use (3), the system keeps the source information (4), republishing a copy publicly or commercially must stay within the rights the creator granted (5). So the Terms are not missing a grant. **What is missing is the per-trip switch** the creator turns on (RK16), plus a defined meaning for point 5, because nothing in the data says what a given creator granted.
4. **Roles need no new action.** `member` has no staff actions (`permissions.ts`, `ROLE_ACTIONS`); a member acts on own data by ownership, as with trips and reviews. Staff force-hide uses the existing `community:moderate`.
5. **Privacy is partly settled.** ADR 0024 fixed the guest identifier (HMAC, 30 days). The Privacy Policy text stays the owner's (P11-D1); this ADR writes none of it. A profile adds the first member-authored public free text (the bio) and the first optional public page about a person.

What we do not know: real copy volume; whether counsel reads Article 3 as covering a copy that is edited and republished; whether members want a public page at all (Q1 below); the existing per-user trip cap in the repository (not checked here; the PR verifies it).

## Decision

### 1. Member profile (`member_profiles`)

- **Shape.** One row per member, 1:1 on `userId` (primary key): `publicSlug` (unique, nullable), `bio` (≤280, plain text, nullable), `visibility` (`private` | `public`, default `private`), `updatedAt`. **No `avatarAssetId`** — avatar upload is Phase 13 and adds its column then (no inert schema, ADR 0019). No foreign key (ADR 0013); a missing row reads as the default private profile, so no backfill is needed.
- **Private by default; opt-in public page.** A member becomes public only by choosing a slug and setting `visibility='public'`. Making it public requires accepted Creator Terms (it is publishing a bio) and the `profilePublicOpen` gate below. Anything else is the private default.
- **Slug.** The user chooses it (`[a-z0-9-]{3,30}`, no leading/trailing hyphen), it is **never derived** from `handle`, email, id or display name, and a reserved list (route words, `admin`, `quan-tri`, the site name, staff-looking words) is refused. There is no verified badge. Changing it frees the old slug at once (no redirect, no quarantine); the PR rate-limits slug changes through the async limiter. A freed slug can be taken by someone else; the reserved list and Report are the mitigation, not a promise.
- **Public allow-list.** The public read returns exactly: `displayName`, `bio`, `slug`, and the member's **published, non-anonymous** trip cards. Never `userId`, `handle`, email, role, timestamps, counts of private items or review text. A builder names every field (the `buildCommunityCard` pattern); an enumerating test asserts it.
- **Name consistency (the rule).** One public name per person: `users.displayName`. The profile has **no separate display name**. `authorDisplay = 'anonymous'` always wins: an anonymous trip or review is never linked to a profile, never listed on one, and never named in `origin`. A card or review links to the profile only when `authorDisplay = 'name'` **and** the profile is public. Existing behaviour is kept: gallery cards read the live name, reviews and `origin` keep a snapshot; a rename therefore does not rewrite old reviews (stated limit, not changed here).
- **Deletion and hiding.** `deleteUser` removes the member's profile row in the same transaction (both stores, import/export updated). A soft-deleted or banned user's profile reads `404` (public reads filter on an active user). Staff can force a profile back to `private` and clear a bio with `community:moderate`, written to `audit_events` (`targetKind: 'user'`, reason required, bio text never logged).
- **API.** `GET/PATCH /api/planner/profile` (own profile; `PATCH` strict body, same-origin, `If-Match`-free because the row is small and last-write-wins), `GET /api/community/profiles/[slug]` (public, `404` identically for unknown, private, banned and deleted). `profile` is added as a report target to the existing reports flow. No directory or search of profiles in this phase. The page route is added to the pathname map in the UI PR (VI default, unprefixed; EN translation).
- **Gate `profilePublicOpen`.** A site-config boolean like `contributionOpen`, **off** until the owner has published the Privacy Policy (P11-D1). While off, `PATCH` refuses `visibility='public'` with `403 profile_public_unavailable`; the private profile and the author-name display work regardless. This keeps the code shippable before the owner's policy text exists, without inventing it.
- **Audit.** Visibility flips write `profile_public` / `profile_private` to `audit_events` (`targetKind: 'user'`, `targetId` = user id, no bio content).

### 2. "Use this trip" (`POST /api/community/trips/[token]/use`)

- **Who and when.** A signed-in member with accepted current Creator Terms (`requireTermsAccepted`; the copier is bound by Article 3 point 5, so they accept first). The source must be **active, `listing.status = 'approved'`, `visibility = 'public'`, owned by an active user, and `listing.allowCopy = true`**. Every failure to meet these returns the same `404` (no probing of which). Copying one's own trip is `409 invalid_state` (`own_trip`); the owner uses `duplicateTrip`. Because an edit re-queues an approved trip to `pending`, a trip under re-review is temporarily not copyable; that is accepted.
- **The per-trip switch.** `allowCopy` lives **inside `listing`** (boolean, default `false`, absent reads as `false`), chosen by the creator in the listing request body (`{ authorDisplay, allowCopy }`, strict) and changeable by the creator later while listed without re-moderation (it is not content). Only the creator turns it **on**; staff can turn it **off** (takedown). Withdrawing the listing clears it with the rest of `listing`; a new request chooses again, defaulting to off. This is the switch Article 3 refers to; no Terms text changes.
- **Turning it off later.** New copies stop at once. **Existing copies stay**: Article 3 gives the copier a personal copy and says nothing of retraction, so the system does not delete or reach into a member's private draft. A copyright takedown (ADR 0014 contact) is a staff and owner matter on the copy, outside this flow. Counsel confirms this reading (Q4).
- **What is copied: the public projection, never raw rows.** The copy is built from the same sanitised projection a visitor can already read through the share link (ADR 0005), so nothing private can reach it. Within that projection, only:
  - trip: `title` (+ copy suffix, ≤120), `destinationSlug`, `durationDays`, `partySize`, `travelStyle`, `pace`, `sourceTemplate`;
  - days: `dayNumber`, `title`;
  - activities: `order`, `placeSlug`, `title`, `startTime`, `durationMinutes`, `category`.
  
  **Not copied:** every free-text `note` (trip, day, activity), `budget` and all expenses, activity cost estimates (reset to the schema defaults; the copier re-enters costs), `startDate`/`endDate` and day dates (null; dates are the copier's), `shareToken`, `visibility`, `listing`, `ownerId`, `duplicatedFromTripId`. The PR confirms each name against the current projection and the schemas and fails if the projection exposes less than listed (it then copies less, never more). Ids are all new.
- **Result.** A new private `draft` trip owned by the copier, `version 1`, `listing = null`, `shareToken = null`, with `origin` set. The source is only read, never written (test).
- **`Trip.origin` (attribution).** A nullable JSONB column `{ sourceTripId, sourceTitle, sourceAuthor, copiedAt }`:
  - `sourceAuthor` is the source's display name at copy time, or `null` when the source was anonymous (**never** a user id, handle or email). `sourceTripId` is internal and never serialised.
  - Shown only to the copier on their own trip, as "Based on «title» by NAME" (or "Based on a community trip" when anonymous). It links to the source **only while the source is still published**; otherwise it is plain text.
  - **No sync back**, either way: the copy and the source never change each other. Source withdrawn, unpublished, hidden or `allowCopy` turned off: the copy keeps its text attribution. Source author hard-deleted: `deleteUser` nulls `sourceAuthor` and `sourceTripId` on every copy in the same transaction; `sourceTitle` stays (public content title).
  - `origin` is the cross-user link; `duplicatedFromTripId` stays the own-trip link and is `null` on a copy.
- **Republishing a copy: not in Phase 11.** While `origin` is set the trip cannot be `public` (`409 invalid_state`, reason `copy_not_republishable`, enforced in `setVisibility`/`requestListing`); it may be `private` or `unlisted` (a link to friends is personal use). Article 3 point 5 refers to "the rights the creator granted", and the data holds no per-trip republish grant, so the default is none. This also means a copy never reaches the gallery or moderation queue in this phase. Lifting it later (a second switch, or republish with mandatory attribution through ordinary moderation) is a separate decision with counsel (Q3, RK16) and needs no migration beyond a new listing field.
- **Quota and abuse.** The async limiter of ADR 0019, key per user: proposed 10 copies/hour and 30/day (`429` with `Retry-After`, the existing shape); a user over their trip cap (if the repository has one — to verify) is refused as for any create. Copies of one source by one user are allowed but count.
- **Audit.** `audit_events` row on the **source** trip: `targetKind: 'trip'`, `targetId` = source id, `actorId` = copier, new action `use`, reason = new trip id; plus `allow_copy` / `deny_copy` when the switch changes. The author-facing events projection (no actor identity) **filters `use` out**: authors see no copier and no per-copier trace; a copy count is Phase 14 stats, not here.
- **Restrictions.** An active user restriction on the copier blocks the copy like any community write (ADR 0015). No new staff action: staff disable via `deny_copy` or unpublishing under the existing `community:moderate`.

### 3. State machine and audit

`submission.ts` is **unchanged**: `allowCopy` and `origin` are orthogonal to submission states. Copying requires `approved` (so `pending`, `rejected`, withdrawn and, when added, `changes_requested`/`unpublished` all block it). The new audit actions are `use`, `allow_copy`, `deny_copy`, `profile_public`, `profile_private`; `events.ts` and its author projection gain them with tests. Review hold/remove and restrictions stay as in ADR 0019.

### 4. Migrations

The next free number is `0015` (`db/migrations` ends at `0014_guest_key_privacy.sql`). **`0015` `member_profiles`** (profile PRs) and **`0016` trips `origin` JSONB null** (copy PR); `allowCopy` needs no DDL because `listing` is already a JSONB column (`0005`). Both additive, each with a rollback note, import/export update and a test through both stores (ADR 0014 precedent; rollback drops the table/column and loses the data). This pushes the numbers the database spec reserved for Phase 12+ up by two (`journal_posts` → `0017` and so on); [specs-community-database.md](../specs-community-database.md) is updated with this ADR.

### 5. Recommended PR order

1. **11.1** profile store + `GET/PATCH /api/planner/profile` + `deleteUser` cascade (migration `0015`).
2. **11.2** public profile read + page (behind `profilePublicOpen`), author links on cards, `profile` report target, staff force-private.
3. **11.3** `allowCopy` in the listing request + creator toggle, `origin` column (migration `0016`) and its display; no copy endpoint yet.
4. **11.4** `POST …/use`, limiter, audit, republish block, `deleteUser` origin cascade; then the **button** (can merge with 11.4 if small).

Profile first because it is independent, lower legal risk and unblocks author links; copy depends on the owner's Q2–Q4 answers, which can arrive meanwhile.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) Profile private by default, `allowCopy` in `listing` default off, copy from the public projection with an allow-list, `origin` as a text attribution, no republish in Phase 11 | Matches Article 3 literally (creator turns it on; personal use); no private data reachable by construction; no new state in `submission.ts`; reversible later without migration | Members cannot post an edited copy publicly yet; a copy is blocked while the source is in re-review; a renamed author stays under their old name in old `origin` |
| B Per-trip switch plus a second `allowRepublish` switch now | Gives creators a finer grant | Two switches to explain; moderation of derived trips (duplicates, attribution disputes) arrives before counsel has read Article 3 point 5 |
| C Copy whenever a trip is published, no switch (tracking a global Terms grant) | Simplest code | Contradicts Article 3 ("when the creator turns on"); RK16 stays open |
| D Profile public by default | More discovery | Exposes a display name and bio without a decision; contradicts the owner's privacy direction |

Runner-up: **B**. It lost because the republish scope is the owner's and counsel's call (P11-D2) and a second switch is hard to remove once creators have used it; A leaves room to add it.

## Consequences

Easier: a defensible per-trip grant that matches the Terms; no private field can leak into a copy; author links and the profile page rest on one name rule; the copy is additive (one column, one table).

Harder, and not free:

- **Creators must act** to allow copying; with the default off, early adoption of "Use this trip" will be low.
- **The copy list is a contract**: any new trip field defaults to *not* copied; every field added to `Trip` later needs a conscious entry plus an enumerating test.
- **Existing copies survive a switch-off** by design; a creator who wants a copy gone must go through the takedown contact, and counsel must agree this fits Article 3.
- **Stale names remain** in `origin.sourceAuthor` and reviews after a rename (snapshots); only hard delete clears them.
- **No republishing** in this phase may disappoint; the rule is enforced in the repository, so lifting it is a deliberate code change.
- **A re-review window** blocks copying of a trip the author just edited.
- **Slug squatting and impersonation** are only mitigated (reserved list, report, force-private), not prevented.
- **Reverting** drops member profiles and every `origin`, and copies lose their attribution.
- **The public profile toggle stays disabled** until the owner publishes the Privacy Policy.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Enumerating users through slugs | User-chosen slug, no directory or search, identical `404` for unknown/private/banned/deleted, public reads behind the public limiter, enumerating test |
| De-anonymising an anonymous author through `origin`, a profile list or a link | `anonymous` wins in every projection; `origin.sourceAuthor = null`; `sourceTripId` never serialised; test over every public body (S5) |
| Copy farming and scraping | Per-user hourly/daily limiter, projection-only source, no copy of notes or costs, audit on the source |
| RK16: Article 3 vs the feature | Switch default off; no republish; counsel reads Article 3 against the feature before 11.4 ships (Q3, Q4) |
| Bio abuse (links, personal data, harassment) | Plain text ≤280 rendered inert, report target `profile`, staff force-private |
| Privacy of a newly public name | `profilePublicOpen` closed until the policy is published; opt-in only |

## Follow-up

- Implementation: PRs 11.1–11.4 above; each ships its feature document from `docs/features/_template.md` in both languages and its register row (profiles; use this trip), and updates [architecture.md](../architecture.md) (routes, data, phases), [usage.md](../usage.md) if the config gate is set by environment, and the Phase 11 section of the roadmap.
- Tests: profile defaults private; allow-list enumeration (profile and `origin`); anonymous author absent from profile, list, card link and `origin`; slug uniqueness, reserved words, independence from `handle`; `404` identity for unknown/private/banned; account deletion removes the profile and nulls `origin` author on copies; copy gate matrix (not signed in, terms not accepted, not approved, not public, `allowCopy` off, own trip, restricted user); the copy contains none of the excluded fields (notes, expenses, budget, dates, token, listing); source rows byte-identical before and after; copy becomes a private draft with new ids; copy refused for `public` and for listing; turning `allowCopy` off blocks new copies and keeps existing ones; limiter `429` (hour/day); audit rows and their author projection; migration `0015`/`0016` up/down on both stores and import/export round trip.
- Documents: [specs-community-database.md](../specs-community-database.md) and `.vi.md` (migration numbers, `origin` shape) updated with this ADR; `.claude/roadmap/backlog.md` (P11-1 points here; P11-D2 restated) and `PHASES.md`; no Accepted ADR is edited. Independent `/sec-check` on the allow-list, anonymity and enumeration before 11.4 merges: NOT RUN (recommended).
- Owner decisions needed (recommendation first):
  1. **Public profile page in Phase 11, or only the author name?** Recommended: ship the page behind `profilePublicOpen` (11.2). Fallback: only the name on cards; skip 11.2 and the slug.
  2. **Who may turn copying on?** Recommended: only the creator, per trip, default off; staff may turn it off.
  3. **May a copy be republished?** Recommended: no in Phase 11 (personal use and unlisted link only); decide with counsel whether a later phase allows it, with mandatory attribution and normal moderation.
  4. **After a creator turns copying off, do existing copies stay?** Recommended: yes; counsel confirms Article 3 reading.
  5. **What does the Privacy Policy need before the public page opens?** At least: that a bio and display name become public on opt-in, how to make it private or delete it, and the 30-day guest-key statement (ADR 0024); the text is the owner's.
  6. **Must the copier accept Creator Terms first?** Recommended: yes (they are bound by Article 3 point 5).
  7. **Quota and cost fields:** proposed 10/hour and 30/day; activity cost estimates not copied. Confirm or change.
  8. **Terms wording:** the owner's separate task (D5) of aligning the text (for example the image/video mentions before uploads exist). Changing it bumps `termsVersion` and forces re-acceptance; this ADR does not edit it.
