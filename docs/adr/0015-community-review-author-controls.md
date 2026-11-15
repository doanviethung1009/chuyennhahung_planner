# ADR 0015 — Staff controls over review authors: ask the author, switch off an author

🇻🇳 Bản tiếng Việt: [0015-community-review-author-controls.vi.md](0015-community-review-author-controls.vi.md)

- **Status:** Accepted as recommended (owner approved 2026-11-15); PR 1 (hold / ask the author, migration `0007_review_hold.sql`) and PR 2 (restrictions, migration `0008_review_restrictions.sql`) implemented. PR 2 deviations: the author sees restrictions through a `restrictions` list on `GET /api/planner/reviews` rather than a field on `OwnReview`, and no new staff limiter was added because session admin writes already pass the 30/min per user limiter (ADR 0010). Question 1–7 under Follow-up stand on the recommended answers until the owner says otherwise
- **Date:** 2026-11-15
- **Owner:** system-architect
- **Decided by:** pending (owner request 2026-11-15: staff may ask the author, and may switch off a given author's or guest's reviews for a place or for that Planner account)
- **Affects:** `src/server/planner/{schemas,repository}.ts`, `src/server/persistence/planner-rows.ts` + `planner-transfer.ts`, migration `0007`, `src/server/identity/permissions.ts`, `src/app/api/admin/community/**`, `src/components/admin/community/review-queue.tsx`, `src/components/reviews/place-reviews-panel.tsx`, `messages/*.json`. Extends [ADR 0014](0014-community-trips-and-reviews.md); changes none of its public projections.

## Context

[ADR 0014](0014-community-trips-and-reviews.md) shipped place reviews with **no
pre-moderation** (owner decision). Staff (`community:moderate`: editor, admin, service)
have exactly one lever: `decideReview(…, 'remove')` on a single review, afterwards. An
author cannot overwrite or delete a staff removal (security review, PASS_WITH_WARNINGS).

The owner now asks for two things: staff can **ask the author** about a review, and staff
can **switch off ("tắt")** an author's or guest's reviews "với địa điểm hay planner đó".

What the code tells us, and what it does not:

- A **Planner author** has a `plannerUsers` row: display name, an *optional* email
  (operator-created accounts may have none; Google sign-up supplies one), a role.
  Reviews carry `authorId`; the queue shows only the account's display name.
- A **guest** has no identity. The only trace is `guestKey`, the first 32 hex characters
  of SHA-256 of the client key — `x-forwarded-for`'s first value, else `x-real-ip`, else
  `'unknown'` (`clientKey` in `src/server/rate-limit.ts`). That header is forwardable;
  without a trusted proxy every client shares `'unknown'`; behind NAT many people share one
  address; and a hash of an IPv4 address is reversible by enumeration, so `guestKey` is
  *pseudonymous personal data*, not anonymous. Guests **cannot be contacted**, and
  blocking by key is weak in both directions (evaded by changing the header, harmful to
  innocents on a shared address).
- There is **no mail sending** anywhere in the project, no mail provider and no sender
  address; the takedown contact in `src/content/site.ts` (`contribution`) is still `null`.
  None is invented here.
- "địa điểm hay planner đó" is ambiguous. Readings:
  **A** per place — switch the author off for *that place* only;
  **B** per Planner account — all places;
  **C** (guests only) per place — close guest reviews on that place altogether.
  The design below supports A and B with one field (`placeSlug` null or not) and names C
  as an optional extra.

## Decision

Proposed — to be confirmed by the owner.

1. **Ask the author = an in-app staff note, Planner authors only.** A new review status
   `held` ("hidden while staff ask the author a question"). Staff run
   `PATCH /api/admin/community/reviews/[id]` with `{ decision: 'hold', reason }`; `reason`
   (3–500 chars) is the question. It reuses the existing `decidedBy`, `decidedAt` and
   `rejectReason` fields — no new column, only a wider `status` check in PostgreSQL. A
   `held` review is **not public** (filtered out like `removed`, and out of the average).
   The author sees it on the trip-detail Planner reviews panel (`OwnReview` already carries
   `status` and `rejectReason`) with a plain notice, and **answers by editing the review**:
   `upsertPlannerReview` on a `held` row publishes it again at once (`approved`, note
   cleared) — consistent with "no pre-moderation"; staff can still `remove` it. `held`
   applies to `source: 'planner'` only; a guest review can only be removed. Staff may also
   leave a note without hiding — not offered in v1 (see options).
2. **No email, no out-of-band contact in v1.** Staff do not see the author's email; the
   queue keeps showing the display name. Contacting by email would need a mail channel
   and a consent/legal basis the project does not have. Not designed here.
3. **Switch off = a `ReviewRestriction`, not a flag on the user.** New entity in the
   Planner store (table `review_restrictions`, JSON key `reviewRestrictions`, no foreign
   keys): `id`, `subject: 'user' | 'guest'`, `authorId | null`, `guestKey | null`,
   `placeSlug | null` (null = every place), `reason` (3–500), `createdAt`, `createdBy`,
   `expiresAt | null`, `liftedAt | null`, `liftedBy | null`. Rows are never deleted, so the
   table *is* the audit trail; lifting sets `liftedAt`.
4. **Staff never type or see an id or a key.** `POST /api/admin/community/restrictions`
   takes `{ reviewId, scope: 'place' | 'all', reason, expiresAt? }`; the server derives the
   subject from that review (author id, or guest key). `GET /api/admin/community/restrictions`
   lists them; `DELETE …/restrictions/[id]` lifts one (idempotent).
5. **An active restriction does two things, both reversible.**
   (a) **Blocks new writes** in its scope: `upsertPlannerReview` and `createGuestReview`
   refuse with `forbidden` (403) and a stable message. (b) **Hides existing reviews in
   scope at read time** — `listApprovedReviews`, the average and the home strip filter on
   active restrictions; stored reviews and their `approved` status are untouched, so
   lifting restores them with no mass update. Hiding is not "removal": the per-review
   `removed` decision stays permanent and is never undone by a lift.
6. **The author may still delete their own live review** while restricted (their data),
   but not a `removed` one (ADR 0014 rule stays). Deleting the account deletes its
   restrictions with its reviews.
7. **Guests: time-boxed and guarded.** A guest restriction requires `expiresAt`
   (default 30 days, maximum 90) and is refused when the review's key is the hash of
   `'unknown'` (blocking it would silence every guest). The admin screen warns that an
   address may be shared. The refusal to a blocked guest is honest ("reviews from this
   connection are paused", plus the takedown contact once configured) — they may be
   collateral. This is a speed bump against a repeat offender, not identity enforcement.
8. **Authorization.** Hold and per-review remove stay on `community:moderate` (editor,
   admin, service). Restrictions are a heavier power over a person: a new action
   **`community:restrict`**, admin and service only, added to `ROLE_ACTIONS` and the `can`
   matrix test. A principal cannot restrict an account that holds `community:moderate`.
   Every staff write goes through `adminPlannerRoute` (same-origin for cookie sessions,
   ADR 0010) and a new per-principal limiter (60 writes/hour); `decidedBy` /
   `createdBy` record the actor.
9. **What the author sees.** `OwnReview` gains an optional `restriction`
   (`{ scope, reason, since, expiresAt }`) so the panel can say *why* writing is closed,
   and `status: 'held'` shows the question. **Appeal:** there is no in-app reply
   (replies stay out of scope, ADR 0014). Until the owner supplies `takedownContact`, the
   notice carries no contact; once supplied it is shown and appeals go there.
10. **Public projections do not change.** `PublicCommunityReview` and
    `CommunityTripCard` keep their field-by-field allow-lists; the existing enumeration
    tests must still pass untouched. `ReviewQueueItem` (staff-only) gains
    `authorId`-free fields only: a `restricted` boolean and the active restriction id.
11. **Storage and delivery.** Migration `db/migrations/0007_review_hold.sql` (PR 1)
    widens the `community_reviews.status` check to include `held`; PR 2 creates
    `review_restrictions` in `0008`; rollbacks in `db/rollback/`. Mirrored in
    `planner-rows.ts`, `planner-transfer.ts` and the JSON document. Delivered in **two
    PRs**: PR 1 hold/ask (decision 1, status migration), PR 2 restrictions (3–10).

## Options considered

### Ask the author

| Option | For | Against |
|---|---|---|
| A (chosen) In-app note + `held`, answer by editing | Needs nothing new: no mail, no contact data, no consent question; reuses fields; the author's edit is the reply | Passive: the author only sees it on opening the trip page; guests cannot be asked at all |
| B Note only, review stays public | Gentler | Nothing stops a harmful review while the question waits — the reason staff would ask |
| C Email the author | Reaches them | No mail provider or sender exists; owner contact data missing; email may be `null` or Google-supplied; needs a consent basis |
| D Show staff the account email to write out of band | Zero build | Spreads personal data to every editor; no audit; unsuitable for guests/`null` emails |

Runner-up is B; it lost because asking without pausing leaves the problem live. A
"note without hold" can be added later as a flag without schema change.

### Switch off

| Option | For | Against |
|---|---|---|
| A (chosen) `ReviewRestriction` rows, place or account scope, read-time hiding | Both readings (A, B) with one field; reversible; audit by construction; no mass rewrite | A new table and a read-time filter on every public review read |
| B A `reviewsDisabled` flag on `plannerUsers` | One column | Account scope only; no reason, actor or history; cannot cover guests |
| C Mass-`remove` the author's reviews | Reuses `decideReview` | Irreversible and loses the difference between "this review" and "this person"; a mistaken mute needs manual repair |
| D Block guests by key forever | Simple | Forgeable, hits shared addresses and `'unknown'`, stores a reversible address hash indefinitely |
| E (optional, reading C) A per-place switch that closes **guest** reviews on that place | Not forgeable by headers; no personal data | Punishes every guest; place-level only; separate decision |

Runner-up is B; it lost because it cannot express "for that place" and leaves no trail.

### Scope reading

| Reading | Meaning | Note |
|---|---|---|
| A | Author muted for one place | Proportionate first response |
| B | Author muted on every place ("that Planner") | Needed for a repeat offender; evaded by a new account |
| C | Guest reviews closed on a place | See E above |

Recommendation: ship A and B together (cost is a nullable field), default the admin
screen to *place*, make *all places* an explicit choice. C is not recommended now.

## Consequences

Easier: staff get a graduated response — ask, pause, mute for a place, mute everywhere —
instead of only deleting; every step is logged; lifting a mistake is one call; public
output stays the same.

Harder, and not free:

- **Weak against guests**: the key is forgeable and sometimes shared. The guest mute is
  time-boxed on purpose and cannot be strong without an identity the owner has not chosen.
- **Evadable for accounts**: a muted traveller can open a second account (Google
  sign-up is open when enabled). We accept this; a stronger answer needs identity work
  (ADR 0007 follow-ups).
- **Passive channel**: a note is seen only when the author opens the trip page. No email,
  no badge; an unresponsive author leaves their review hidden. That is deliberate for now.
- **A new moderator power over people**: wrong use is a harm in itself, hence the
  reasons, actor logging, expiry for guests, the `community:restrict` split and an owner
  decision on who holds it. Restriction rows contain personal data (author id, guest
  key) and are deleted with the account.
- **Read cost**: every review read joins active restrictions in memory; fine at the
  assumed volume (hundreds of reviews), revisit if it grows.
- **Authors and the removal rule**: `held` is the only non-public state an author can
  leave by editing; `removed` and `rejected` stay closed (decision 1 does not weaken the
  security review's rule).
- Reverting: remove the routes and UI; the table and status value stay inert; the
  rollback file drops them manually and must first move `held` rows to `approved` or
  `removed`.

## Follow-up

- Contract and owner split: `.claude/contracts/community-review-author-controls.md`.
- On acceptance: update `docs/architecture.md` + `.vi.md`, `docs/usage.md` + `.vi.md`
  (how staff hold and mute), `.claude/context/project-context.md`, and extend
  `docs/features/community-reviews.*` (or a new `review-author-controls.*` per owner
  preference).
- **Owner to confirm:**
  1. Reading of "địa điểm hay planner đó": A+B (recommended), A only, or also C?
  2. "Switch off": block new writes **and** hide existing reviews in scope (recommended),
     or block new writes only?
  3. Ask the author: in-app note with the review hidden meanwhile (recommended), or the
     review stays public while asked? Is a passive notice acceptable, with no email?
  4. Who may mute: admin and service only, new `community:restrict` (recommended), or
     every editor with `community:moderate`?
  5. Guests: time-boxed key block (recommended, 30/90 days), or no guest block at all
     and rely on `remove` plus reading C?
  6. Does the author see the staff reason verbatim? Appeals go to `takedownContact` — owner
     must supply it (still `null`); do not invent one.
  7. Should staff ever see an author's email? Recommended: no.
- Security review (`/sec-check`) is recommended before merge of PR 2; QC (`/qc-check`)
  for both. Neither has run.
