# Handoff — batch 10.1 Moderation State Machine
Branch `feat/submission-state-machine` (nothing committed/pushed). Contract: `phase10-10-1-state-machine.md`.

## Done
- New `src/server/community/submission.ts` (pure, no I/O, no role checks) + `tests/submission-state-machine.test.ts`.
- `src/server/planner/repository.ts`: only `requestListing`, `withdrawListing`, `decideListing`, `touch` + one import. Stored values, HTTP responses, `invalid_state` messages unchanged.

## Exports 10.2 will call (from `@/server/community/submission`)
- Types: `SubmissionState`, `SubmissionAction`, `ListingStatus`, `ModerationDecision`.
- `transition(state, action): SubmissionState | null` (null = forbidden).
- `listingToState(status | null)`, `stateToListing(state)` (throws RangeError for `changes_requested`/`unpublished`/`archived`).
- `decide(state, 'approve'|'reject'|'remove')` — approve = approve+publish in one step (log two events if wanted).
- `legacyRequest(from)` → `'pending'`, `legacyWithdraw(from)` → `'draft'`.

## Legacy behaviours settled (as recommended, no deviation)
(a) request accepted from any state → pending; (b) withdraw / implicit end (leaving public, archive) from any state → draft (null); (c) staff `remove` = module `removed`, stored `rejected`. (a)(b) are wrapper edges, not in `transition`.

## Hooks for 10.2
Events belong inside the same `transaction` callbacks; `fromStatus = listingToState(old)`, `toStatus` = returned state. `touch` re-queue = `published --edit_material--> pending` (actor = trip owner). Implicit end in `touch` still sets `listing = null` inline (not routed via module; log as `withdraw`, `actorKind` service).

## Checks (run in this worktree)
typecheck PASS · lint PASS (no output) · test PASS: 63 files passed, 2 skipped (Postgres integration, no TEST_DATABASE_URL); 896 passed, 30 skipped. `tests/community-trips.test.ts` unmodified.
qc / security: NOT RUN (recommend `/qc-check`).
