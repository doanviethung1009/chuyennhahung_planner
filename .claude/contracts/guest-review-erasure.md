# Task Contract: guest-review-erasure — staff erase a guest review on a data-removal request
- Class: L (privacy boundary, irreversible data change, new action). State: READY. Subagents: 0. Branch `feat/guest-review-erasure`. No new ADR: implements ADR 0024 §8 / Follow-up unchanged.
- Desired outcome: a staff member can irreversibly strip the personal content of one **guest** review after a mailbox request (`contribution.takedownContact`), leaving an audit trail and no recoverable content in the store, the Postgres table or the export.
- Scope IN: repository `eraseGuestReview`; `POST /api/admin/community/reviews/[id]/erase`; action `community:erase`; "Xóa nội dung" button + confirm dialog in `review-queue.tsx`; VI/EN strings; docs EN+VI; ADR 0024 one follow-up line; tests JSON + Postgres.
- Scope OUT: privacy-policy page, member-account deletion, sec-check W1–W7, doc finding F1, limits, report UI, restoring an erased review.
- Evidence: `repository.ts` decideReview (~2003), deleteOwnReview (~1827), createGuestReview cap by `source='homepage'` rows per place per 24 h (~1861), sweepGuestKeysIn (~3311); `events.ts` appendEvent; `permissions.ts` ROLE_ACTIONS; `[id]/route.ts`; `planner-rows.ts` (`community_reviews`: body NOT NULL, visited_on NOT NULL; zod body min 60).

## Design decisions
(a) **Anonymise in place** (recommended) vs hard delete (runner-up). Hard delete would let the 20/place/day cap undercount, orphan the audit trail and the reports that point at the id. In place: `body` → fixed neutral sentence `ERASED_REVIEW_BODY` (≥60 chars, satisfies the schema and the NOT NULL column, so **no migration**), `authorName` null, `guestKey` null, `rejectReason` null (a past removal reason may quote the text), `visitedOn` → date of `createdAt`, `rating` → 1, `status` `removed`, `decidedBy` actor, `decidedAt`/`updatedAt` now. Kept: `id`, `source`, `placeSlug`, `lang`, `createdAt`.
(b) Only `source='homepage'`; a Planner review → `invalid_state` 409 (account delete / author delete cover it). Works from every status including already `removed` (a plain remove keeps the text, so erase must still reach it).
(c) **New action `community:erase`**: admin, super_admin, service. Not editor, not member (irreversible, like `community:restrict`). Matrix pinned in tests.
(d) One audit event `erase` (targetKind review, from prior status → `removed`, reason = staff text ≤500), same transaction. Idempotent: a review already erased returns without an event. No restore API.
(e) Reason 3..500 required, staff-typed; UI warns not to include the requester's personal data (use a ticket/mail reference). Earlier audit events on the same review are append-only and untouched (their reasons are staff text; the warning applies to them too).
(f) Open reports on the review still resolve (`resolveReport` does not read the review). Public projection excludes it (status removed). Restrictions keep their own key (≤30 days, ADR 0024). Queue marks it erased; mute button hidden.
(g) JSON and Postgres share the repository code; no schema change.

## Interface
`POST /api/admin/community/reviews/{id}/erase` body `{reason}` strict → `200 {id,status:'removed',erased:true}`; 401/403 as other admin routes (cookie ⇒ same-origin check, no-store); 404 unknown; 409 planner review. `ReviewQueueItem.erased: boolean`.

## Acceptance / tests
Anonymised fields; content/key absent from `JSON.stringify(store)` and from export; failure writes nothing; second call no new event; member 403 / editor 403 / admin ok / service ok; Planner review 409; open report resolvable; public list excludes; exactly one event; removed-then-erase works; guest cap still counts erased row; JSON + Postgres (TEST_DATABASE_URL, else NOT RUN); i18n parity; existing tests unchanged (fixture changes listed in handoff).
## Risks / rollback
Irreversible by design: revert code leaves erased rows erased. Only the audit reason may hold requester text — warned in UI. Open question for owner: keep `rating` reset to 1 or keep original? (chosen: reset). No migration.
- Feature doc owner: this session (`community-reviews.*`, `moderation-events.*`, `runbook.*`, `architecture.*` if needed, `project-context.md`).
