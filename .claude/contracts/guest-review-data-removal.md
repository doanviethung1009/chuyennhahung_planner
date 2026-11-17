# Task Contract: guest-review-data-removal — finish the guest review erasure (residual data)
- Class: L (privacy boundary, irreversible data change, touches the append-only audit log). State: **APPROVED by owner, Q1–Q3 defaults; implemented, uncommitted.** Subagents: 0. Follows PR #139 (merged, `eraseGuestReview`, [guest-review-erasure.md](guest-review-erasure.md)), ADR 0024 §8 unchanged.
- Branch: current worktree branch is `claude/guest-review-data-removal-fab65d`. Proposed rename to the project convention: `fix/guest-review-erasure-residuals` (needs owner OK; one `git branch -m`, nothing pushed yet).
- Desired outcome: after a staff erase, **no text, key or star that came from the guest survives** in `community_reviews`, `reports`, `audit_events` or `review_restrictions`; only non-identifying audit metadata and the security-bounded key remain, each stated and tested.

## Findings (evidence: repository.ts `eraseGuestReview` ~2086, `createReport` ~2140, `resolveReport` ~2235, `createRestriction` ~2276, `sweepGuestKeysIn` ~3381; events.ts; planner-rows.ts)
| # | Where | What survives an erase today | Verdict |
|---|---|---|---|
| R1 | `reports.note` (≤500, reporter free text) on reports whose `targetId` is the review | May quote the guest's text; `listReports` returns it to staff | **Delete** (set null) |
| R2 | `reports.handlerReason` + the `report_actioned`/`report_dismissed` audit event `reason` (targetId = review id) | Staff text, may quote content | **Delete** reason text, keep the rest of the event |
| R3 | `audit_events.reason` on every earlier event with `targetId = review id` (`reject`, `remove`, `hold`) | Staff text; a removal reason often quotes the review | **Delete** reason text only |
| R4 | `review_restrictions.reason` for a restriction on this review's guest key + place (NOT NULL column) and the `restrict`/`lift` audit events (targetId = restriction id) | Staff text, may quote content | **Delete** (restriction keeps a fixed marker; events get null) |
| R5 | `review_restrictions.guest_key` (HMAC hash) | Links the erased review to a still-active restriction for ≤30 days (ADR 0024, swept when it ends) | **Keep until it ends** (abuse control, bounded, hashed, never shown) — owner may choose to lift it instead (Q2) |
| R6 | The `erase` event itself: actor, time, from→removed, staff `reason` (≤500, UI warns not to put requester data) | Proof that the request was handled | **Keep** (legal/accountability); swept after 365 d with the log |
| R7 | `community_reviews` kept fields: `id`, `source`, `placeSlug`, `lang`, `createdAt`, `decidedBy`, `decidedAt` | No guest content; needed for the 20/place/day cap and audit/report references | **Keep** |
| R8 | `rating` | **Not retained**: `eraseGuestReview` already writes `rating: 1` (the original star is overwritten). `1` is a placeholder (column is `int NOT NULL`, zod `min(1)`), not the guest's value | See Q1 |
| R9 | `reports.client_key` / `reports.reporter_id` | The *reporter's* data, a different data subject; hashed key already swept at 30 d | **Keep** (not the guest's) |
| R10 | Backups, PG dead tuples/WAL, nginx/error logs | Outside the application | Out of scope; stated in the runbook |
| R11 | **Backfill gap** — `eraseGuestReview` returns early for an already-erased row, so rows erased by PR #139 keep R1–R4 forever | Must be fixed in the same change | Cleanup must run on an erased row too, without a second `erase` event |
| R12 | Restriction link is found through the review's `guestKey`, which the erase nulls | For rows erased before this change the link is gone; those restrictions end within ≤30 d anyway | Stated limitation, no code |

Impact checked: **Aggregates** — `listPublicReviews` counts only `status = 'approved'`, so a removed/erased row (placeholder rating 1 included) never enters the average or the count; pinned by a test, no code change. **Reports** — still resolvable (`resolveReport` does not read the review); queue shows the fixed notice as label. **Audit** — action/actor/status/time stay, so the history of "something happened to review X" remains. **UI** — queue already marks `erased`; event and report views must render a redacted (null) reason. **Restrictions** — see R4/R5.

## Design
(a) `eraseGuestReview` becomes: find review → (already fully clean ⇒ return) → in the same transaction: null `note` and `handlerReason` of reports with `targetKind='review' && targetId`; null `reason` on `auditEvents` with `targetId` = review id (except the event written now) and on events whose `targetId` is a restriction found for this review; set the matching restrictions' `reason` to a fixed marker constant; then anonymise the review as today.
(b) New helper in `events.ts`: `redactEventReasons(data, targetIds, exceptEventId?)`. This is the single, named exception to "append-only": reason text only, never action/actor/status/time. Documented in the ADR 0019 note and the moderation-events doc. Nothing else mutates an event.
(c) Idempotence: "clean" means body = notice, key and name null **and** no residual note/reason found; the check-and-clean runs on every call, the `erase` event is written only on the first.
(d) No schema change, no migration (rating stays a placeholder, see Q1) → no clash with the `0015`/`0016` numbers PR #141 reserves.
(e) UI: confirm text in `review-queue.tsx` adds that reports' notes and earlier reasons are cleared (VI/EN); the event list shows a "redacted" label for a null reason on an erased review only if not already handled by the existing null rendering (check first, change only if needed).

## Owner questions (default in brackets, applied if you just approve)
- Q1 `rating`: keep the placeholder `1` [recommended: no migration, excluded from every aggregate, pinned by test] or a migration making `rating` nullable (new `0015`, collides with PR #141's reserved number — would renumber)?
- Q2 Active guest restriction on an erased review: keep it until it ends with its reason redacted [recommended] or lift it immediately?
- Q3 Redact earlier audit reasons by nulling [recommended] or replacing with a fixed text `[erased]`?

## Scope
IN: `repository.ts` (`eraseGuestReview` + cleanup), `events.ts` helper, `schemas.ts` marker constant, `review-queue.tsx` + VI/EN strings (one sentence), docs EN+VI (`community-reviews`, `moderation-events`, `runbook`, ADR 0024 follow-up line, ADR 0019 one-line exception), tests, `project-context.md`.
OUT: member-account deletion, privacy-policy page, backups/logs, restoring an erased review, `rating` migration (unless Q1 says so), `.claude/roadmap/*`, deploy files.

## Conflicts (checked against the open PRs by file list; no code run)
- #140 (deploy hardening): touches `deploy/**`, `docs/deploy-*`, `docs/usage*`, `docs/features/docker-deploy*`, `tests/deploy-config.test.ts`. **No overlap.**
- #141 (ADR 0025, Phase 11): `docs/adr/0025*`, `docs/adr/README*`, roadmap, `docs/specs-community-database*`. **No overlap** as long as I add no ADR and no migration (so I leave the ADR index and `0015` alone). Later Phase 11 code will edit `repository.ts`: textual merge risk is low, different functions.
- #145 (roadmap + `deploy/.env.example`): **No overlap.**
- Base `main` = 53aa123 (PR #144 merged); this branch is clean and equal to it.

## Tests (extend `tests/guest-review-erasure-cases.ts`, run on memory and Postgres)
1. A planted marker string in review body, report note, report handler reason, reject reason, restriction reason and their events → absent from `JSON.stringify(store)` after erase, except inside the erase event's own reason; same on Postgres via a `SELECT` over the four tables.
2. Kept: event ids/actors/actions/statuses/times, restriction id + hashed key until it ends, the `erase` event with its reason.
3. Rating: original 5 is stored as 1; an approved 5-star + erased 5-star → public summary count/average ignore the erased one; `average` null below `MIN_REVIEWS_FOR_AVERAGE`.
4. Backfill: an already-erased review with a residual note/reason → second call cleans, writes **no** second `erase` event; fully clean → no write.
5. Report on the erased review is still resolvable; `listReports` shows `note: null`, label = notice.
6. Other reviews/reports/events/restrictions of other guests untouched; a Planner review still 409.
7. Failure mid-transaction writes nothing; i18n parity VI/EN; the existing 1093 tests unchanged.

## Risks / rollback
Irreversible by design; revert leaves cleaned rows cleaned. Risk: redacting audit reasons weakens "append-only" — contained to one helper, one call site, reason text only, tested. Risk: R12 leftovers for rows erased before this change (stated). `/sec-check` recommended before merge: **NOT RUN** until the owner asks.
Definition of done: typecheck, lint, test with output stated; Postgres integration against `TEST_DATABASE_URL` or NOT RUN; browser check NOT RUN unless asked. No commit, push or merge without the owner's word.
