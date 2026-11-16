# ADR 0019 — Community foundation (Phase 10): one moderation state machine, an audit log, and a shared write limiter

🇻🇳 Bản tiếng Việt: [0019-community-foundation.vi.md](0019-community-foundation.vi.md)

- **Status:** Proposed
- **Date:** 2026-11-16
- **Owner:** system-architect
- **Affects:** `src/server/community/**` (new `submission.ts`, `events.ts`), `src/server/planner/repository.ts` (moderation methods only), `src/server/rate-limit.ts` and a new shared limiter module, `src/server/persistence/planner-rows.ts`, `planner-transfer.ts`, `db/migrations/0010_*.sql`, `src/server/identity/permissions.ts` (no change expected)
- **Part of:** Phase 10 (Community Foundations) in `.claude/roadmap/PHASES.md`: delivers P10-1 (audit log) and P10-6 (shared limiter); see [specs-community-roadmap.md](../specs-community-roadmap.md)

## Context

The [Community Platform specs](../specs-community-overview.md) group the work as spec groups C1–C7, mapped onto Phase 10–15. Phase 10 (spec group C1) is the foundation the rest stands on. Three facts from the repository set its shape:

1. **Moderation is ad hoc and unlogged.** Trip listing moves through `requestListing`,
   `withdrawListing`, `decideListing` and an implicit re-queue in `touch`
   (`src/server/planner/repository.ts`); review remove, hold and user restrictions are
   separate methods. No row records who did what. The Phase 07 backlog lists an audit log
   as undesigned ([architecture.md](../architecture.md#phases)). Later Phase 10 slices need more states
   (`changes_requested`, `unpublished`) and Phase 12 a second content type, so the rules must live
   in one place before they multiply.
2. **The write limiter is per process and resets on restart.** `createRateLimiter` keeps
   hits in a `Map` (`src/server/rate-limit.ts`); its own header says so, and ADR 0005 and
   0008 name a shared store as the prerequisite for a second instance. Auto deploy
   (ADR [0016](0016-auto-deploy-dev.md)) restarts the process on every green `main`, which
   empties every bucket. Community adds write paths (copies, reports, comments, uploads)
   where that matters more than for the guest reviews it protects today.
3. **Nothing visible has to change.** Everything here is groundwork. The contribution gate is **open** on `main` (terms and takedown contact are filled), so existing trip and review writes are live without an audit log or a Report control; that is why this phase comes first.

What we do not know: real write volume, and whether the PostgreSQL VM adds noticeable
latency per limiter check (assumed to be a LAN round trip; unmeasured).

## Decision

This ADR delivers **three things, none visible to a visitor**, in three PRs; the rest of Phase 10 (Terms acceptance, reports, publication states) is its own slice. Anything with no
consumer until a later phase is deferred to that phase (CLAUDE.md rule 4 spirit: no dead
surface, and no inert schema).

### 1. One moderation state machine, `submission.ts`

- A pure module, no I/O, unit-tested like `budget.ts`. It exports `SubmissionState`, the
  actions, and `transition(state, action) → state | null` (`null` means not allowed).
- States and edges are exactly those of the diagram in
  [specs-community-moderation.md](../specs-community-moderation.md). It does **not** check
  roles; callers do, through `can()`.
- **Existing behaviour is preserved.** Trip listing is re-expressed through it with a
  read-only mapping: `none` ↔ no submission, `pending`, `approved` ↔ `published`,
  `rejected`. The stored `listing` shape and its three statuses do not change in this ADR;
  `changes_requested` and `unpublished` are added in a later Phase 10 slice with their migration. The
  repository calls `transition` to validate, and keeps today's error codes (`invalid_state`).
- Review remove/hold and user restrictions stay outside the state machine (owner decision:
  short reviews are post-moderated under ADR 0014/0015), but are **logged** (next point).

### 2. `AuditEvent`: an append-only log inside the same transaction

- Fields: `id`, `targetKind` (`trip`, `review`, `user`), `targetId`, `actorId`, `actorKind`
  (`user` or `service`), `action`, `fromStatus`, `toStatus`, `reason` (≤500), `createdAt`.
- Written **in the same Planner-store transaction** as the change it describes, so a
  decision and its record cannot diverge. Every existing community staff and owner action
  writes one: request, withdraw, approve, reject, remove, the re-queue after an edit,
  review remove and hold, restriction apply and lift.
- Append-only: no update or delete method, no API to edit. Read by staff through
  `GET /api/admin/community/events?targetId=` (action `community:moderate`); an author
  sees events on their own trip through a projection without actor identity.
- Stored in the Planner store (low volume), as a table `audit_events` mirrored in
  `planner-rows.ts` and `planner-transfer.ts`, and as the document key `auditEvents`
  in the JSON store. No foreign keys (ADR 0013). Retention: kept 1 year, then swept; the
  actor id of a deleted staff user is retained as a pseudonymous id.
- This **is** the shared audit log of PHASES.md P10-1 (= P07-4): one table, community actions first. Role and template changes use the same table in a later slice, not here.

### 3. A shared, PostgreSQL-backed limiter for write paths

- New interface `AsyncRateLimiter { check(key): Promise<RateLimitResult> }`, next to the
  existing synchronous one, which is **kept** for reads and for the JSON store.
- A **fixed-window counter** in a table `rate_limit_counters (key, window_start, count)`,
  incremented with one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING count`. It
  bypasses the Planner store's whole-store transaction on purpose, so it does not
  serialise on the store lock (ADR [0009](0009-postgres-persistence.md)). Old windows are
  swept opportunistically. A fixed window can pass up to twice the limit across a window
  boundary; that is accepted for abuse control.
- Chosen in `planner/instance.ts` exactly as the store is: PostgreSQL when
  `PLANNER_DATABASE_URL` is set, otherwise the in-process limiter wrapped to the async
  interface. No fallback from a configured database.
- **Moved by this ADR:** `plannerReviewLimiter` and `guestReviewLimiter`. **New write limiters
  from the next slice on use it from the start.** Sign-in, signup, share-read and Google limiters are
  unchanged in this ADR.
- **Keys.** Authenticated writes are keyed by `userId`, which a client cannot forge.
  Anonymous writes remain keyed by `clientKey(headers)`, which is a forwarded header and
  **still spoofable**: a shared store fixes persistence and multi-instance behaviour, not
  spoofing. The trusted-proxy question (Cloudflare Tunnel, nginx) is raised in Follow-up.
- If the database is unreachable a write limiter fails **closed** (`service_unavailable`):
  the write needs the same database anyway.

### Deferred, on purpose

| Item | Moves to | Why |
|---|---|---|
| `Trip.origin` | Phase 11 | First consumer is Use this trip |
| Report entity and control | Phase 10, own slice (P10-3) | Own PR after the log |
| `terms_acceptances` | Phase 10, own slice (P10-2) | Own PR |
| `member_profiles` and public slug | Phase 11 | First consumer is the profile page; avatar upload is Phase 13 |
| `changes_requested`, `unpublished` states | Phase 10, later slice | They need UI to be meaningful |
| Per-row repository for likes and comments (DB5) | Phase 14, after a measurement | No such write path exists yet |

Migration numbering: `0010` audit events and counters (this ADR); later slices follow [specs-community-database.md](../specs-community-database.md). Profiles sit in Phase 11 as PHASES.md already states.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) State machine and event log wrapping existing flows, plus a Postgres write limiter; everything else deferred to its first consumer | No visible change; each piece testable alone; no inert schema; audit trail starts before the volume does | The foundation loses three items to later Phase 10 slices and Phase 11; two limiter interfaces coexist for a while |
| B Phase 10 as first drawn: also `Trip.origin`, reports, profile | Fewer, larger migrations; matches the owner's "Foundation: User Profile…" wording | Ships columns and tables nothing reads; profile has no page until Phase 11; larger PRs to review |
| C Redis for the limiter | Purpose-built, sliding windows, fast | A new service on a 16 GB homelab to patch, back up and secure; ADR 0008 chose PostgreSQL for shared state |
| D Keep the in-memory limiter, key authenticated writes by `userId` | No new moving parts; per-user keys are already unforgeable | Every deploy resets all buckets; breaks at a second instance; anonymous keys stay spoofable either way |

**Runner-up: D.** It lost on one reason: auto deploy empties every bucket on each restart,
so a user's hourly cap is really "per deploy", and the second instance ADR 0008 anticipates
would double it. If the measured cost of a database round trip proves too high, D with a
persisted counter only for the few write paths that matter is the fallback.

## Consequences

Easier:

- Later phases add states and content types by editing one pure module and its transition
  table, not several repository methods.
- Every community staff action is attributable, which also helps takedown disputes.
- A second app instance becomes safe for the write paths that matter.

Harder, and not free:

- **Two limiter interfaces** (sync in-memory, async shared) coexist; callers must choose,
  and a test must keep the choice honest. Merging them is a later cleanup.
- **One database round trip per limited write.** The PostgreSQL VM is separate, so each
  check is a network hop; unmeasured, and a risk if the link is slow.
- **A fixed window is coarse** (up to 2× burst at a boundary). Acceptable for abuse
  control, not for anything that needs exact quotas (upload byte quotas will count rows, not
  use this limiter).
- **The event log is personal data about staff and authors** (actor ids, reasons that may
  quote user text). It needs the 1-year sweep, must not be logged elsewhere, and falls under
  the owner's privacy statement.
- **Refactoring moderation methods risks regressions.** The existing community trip and
  review tests are the net; they must stay green and unchanged.
- **Anonymous spoofing is not fixed.** Anyone relying on "shared limiter" as spoof
  protection would be wrong; it is not.
- **Reverting:** drop the two tables and the module; the repository falls back to today's
  inline checks if the calls are removed. Stored events become inert.

## Follow-up

- Branches and PRs, in order: `feat/submission-state-machine`, `feat/moderation-events`,
  `feat/shared-write-limiter`. Each with its tests and its feature document
  (`docs/features/moderation-events.*`, `docs/features/shared-write-limiter.*`; the state
  machine is documented in the first one).
- Tests: every edge and every forbidden edge of `transition`; legacy listing mapping; an
  event written in the same transaction as each action, and none when the action fails; the
  limiter across two simulated instances sharing one database; fail-closed when the database
  is unavailable; existing community tests unchanged.
- Documents to update on acceptance: `docs/architecture.md` + `.vi.md` (data, boundaries,
  phases), `.claude/context/project-context.md`, the roadmap rows
  ([specs-community-roadmap.md](../specs-community-roadmap.md)) and migration numbering in
  [specs-community-database.md](../specs-community-database.md).
- A Task Contract at `.claude/contracts/community-foundation.md` before code (class L).
- Recommended, not run: `/sec-check` on the limiter and on event-log privacy.
- **Open questions for the owner:**
  1. Resolved: profiles belong to Phase 11 (PHASES.md), not to this ADR.
  2. Is a 1-year retention for `AuditEvent` acceptable?
  3. Behind Cloudflare Tunnel and nginx, which forwarded header is trustworthy for
     `clientKey`? Needs the real deployment, not the repository.
