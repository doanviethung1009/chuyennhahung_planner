# Task Contract 10.1 — Moderation State Machine
- Task ID: 10.1 (no backlog row; ADR 0019 §1; enabler of P10-1)
- Class: M · State: DONE (PR #112, merged 2026-11-16) · Subagents: 0
- Objective: one pure module owns the submission/listing rules, and the trip-listing repository methods call it, with zero change to stored data, HTTP responses or error codes.
- Scope:
  - New `src/server/community/submission.ts` (+ test): `SubmissionState`, `SubmissionAction`, `transition(state, action): SubmissionState | null`, `listingToState` / `stateToListing` (none ↔ `null`, `pending`, `approved` ↔ `published`, `rejected`).
  - `requestListing`, `withdrawListing`, `decideListing`, and the re-queue in `touch` call it for validation (`src/server/planner/repository.ts:1466-1536`, `:2465-2481`).
  - Settle the three legacy behaviours (request from any state, withdraw from any state, staff `remove` stored as `rejected`) as documented wrapper edges, per [community-foundation.md](community-foundation.md) "Interface contract".
- Out of Scope: any stored-shape change, `changes_requested`/`unpublished`, audit events (10.2), reviews and restrictions, routes, UI, migration, `Trip.origin`.
- Architecture Reference: ADR 0019 §1; `docs/specs-community-moderation.md` (diagram, mapping table, M7).
- Dependencies: none. Owner D8 only (no backlog ID).
- API/Data Contract: none public. Internal: `transition` returns `null` for a forbidden edge; callers keep throwing `invalidState(...)` (code `invalid_state`, same messages where tests assert them). No role checks inside the module (callers use `can()`).
- Files Affected: `src/server/community/submission.ts` (new), `tests/submission-state-machine.test.ts` (new), `src/server/planner/repository.ts` (listing methods + `touch` only).
- FE/BE Responsibilities: BE only. FE: none.
- QC Requirements: table-driven test of every edge in the moderation diagram and every non-edge → `null`; round-trip of the legacy mapping; the three legacy behaviours pinned; `tests/community-trips.test.ts` unchanged and green. `/qc-check` recommended after this batch (on the owner's call).
- Security Requirements: no behaviour change may widen who can approve/publish; `decideListing` still requires `isShareable` + `public` for approve (`repository.ts:1519-1524`); approval still re-queues on edit (`:2476-2478`).
- Acceptance Criteria:
  1. Every diagram edge allowed, every other pair `null`.
  2. `listing` stored values identical before/after; existing community-trips tests pass **unmodified**.
  3. Error codes/messages for wrong-status decisions unchanged.
  4. No file outside the list above changed.
- Verification Commands: `npm run typecheck`, `npm run lint`, `npm run test` (state outputs; NOT RUN if skipped).
- Rollback Strategy: revert the PR; no data, no migration. The repository returns to inline checks (git history).
- Definition of Done: criteria 1–4 met, three commands pass with output stated, PR merged; handoff `.claude/contracts/handoff/phase10-10.1.md` written (names the exact exports 10.2 will call).
- Feature document: none here; the state machine is documented in `docs/features/moderation-events.*` (batch 10.2), per ADR 0019 follow-up.
