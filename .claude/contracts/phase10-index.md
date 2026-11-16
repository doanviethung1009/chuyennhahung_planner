# Phase 10 — Community Foundations: Task Contract Index
- Role: system-architect (main session, Single-Agent First). Subagents: 0. Nothing implemented, committed, pushed or deployed by this document.
- Created: 2026-11-16. State of all batches: **READY** — owner approved D1–D12 as recommended on 2026-11-16. Still owner-side, not code: D4 (privacy policy, gates 10.6b only), D5 (exact Terms text, gates 10.4), D10 (real VM proxy/backups facts, gates 10.6a and 10.7). ADR 0019 status flips to Accepted at the start of 10.2 (docs change in that PR).
- Sources (referenced, not restated): `docs/adr/0019-community-foundation.md` (Proposed), `.claude/roadmap/PHASES.md` §Phase 10, `.claude/roadmap/backlog.md` §Phase 10, `docs/specs-community-roadmap.md`, `docs/specs-community-moderation.md`, `…-database.md`, `…-api.md`, `…-security.md`, `…-qc.md`.
- Parent design notes, kept as the evidence base for 10.1–10.3 (file:line citations, legacy behaviours): [community-foundation.md](community-foundation.md). Batches 10.1–10.3 cite it instead of repeating it.
- Task IDs: the backlog IDs P10-1..P10-16 are **unchanged**. Batch numbers 10.1–10.7 are execution groupings only. Batch 10.1 has no backlog row (it is ADR 0019 §1, the enabler of P10-1); no new backlog ID is invented (decision D8).

## Task Contract Index
| Batch | Contract | Backlog IDs | Branch (proposed) | Class | Migration |
|---|---|---|---|---|---|
| 10.1 | [phase10-10-1-state-machine.md](phase10-10-1-state-machine.md) | — (ADR 0019 §1) | `feat/submission-state-machine` | M | none |
| 10.2 | [phase10-10-2-audit-events.md](phase10-10-2-audit-events.md) | P10-1 (= P07-4), P10-14 | `feat/moderation-events` | L | `0010` |
| 10.3 | [phase10-10-3-shared-limiter.md](phase10-10-3-shared-limiter.md) | P10-6, P10-13 | `feat/shared-write-limiter` | L | `0011` |
| 10.4 | [phase10-10-4-terms-acceptance.md](phase10-10-4-terms-acceptance.md) | P10-2 | `feat/terms-acceptance` | L | `0012` |
| 10.5 | [phase10-10-5-reports-queue.md](phase10-10-5-reports-queue.md) | P10-3 | `feat/community-reports` | L | `0013` |
| 10.6 | [phase10-10-6-security-hardening.md](phase10-10-6-security-hardening.md) | P10-12, P10-15, P10-16 (10.6a); P10-11 (10.6b, gated) | `fix/community-hardening` | M + L | 10.6b only |
| 10.7 | [phase10-10-7-verification-smoke.md](phase10-10-7-verification-smoke.md) | P10-4; P10-7 (owner); reviews on demand | none (evidence) | S | none |

Already done, not re-planned: P10-S0, P10-5, P10-8, P10-9, P10-10.

## Dependency Matrix
Rows depend on columns (● hard, ○ soft/recommended).
| | 10.1 | 10.2 | 10.3 | 10.4 | 10.5 | 10.6 |
|---|---|---|---|---|---|---|
| 10.1 | | | | | | |
| 10.2 | ● | | | | | |
| 10.3 | | ○ | | | | |
| 10.4 | | ● | | | | |
| 10.5 | | ● | ● | ○ (Terms text names reports) | | |
| 10.6a | | ○ | ● (P10-12 needs P10-6) | | | |
| 10.6b | | | ● | | | owner D4 (P11-D1) |
| 10.7 | ● | ● | ● | ● | ● | ● (6a) |

External gates: owner accepts ADR 0019 before 10.2/10.3 (10.1 changes no stored data); owner confirms Terms text and version for 10.4 (P10-2 says "owner xác nhận text"); P11-D1 (privacy policy, owner) gates 10.6b; a deployed dev VM gates 10.7.

## File-conflict map (rule: no two batches edit one file at once)
| File | Batches that edit it | Order |
|---|---|---|
| `src/server/planner/repository.ts` | 10.1, 10.2, 10.4, 10.5, 10.6a, 10.6b | strictly sequential |
| `src/server/planner/schemas.ts`, `store.ts`, `persistence/planner-rows.ts`, `planner-transfer.ts`, `tests/planner-pg-fixtures.ts` | 10.2, 10.4, 10.5 (10.6b) | strictly sequential |
| `src/server/rate-limit.ts`, `src/server/planner/instance.ts` | 10.3 only (10.6b reads the key helper) | — |
| `messages/vi.json`, `messages/en.json` | 10.4, 10.5 | sequential |
| `docs/architecture.*`, `docs/features/README.*`, `docs/specs-community-database.*` | every batch that ships a feature | sequential (one PR at a time) |
| `db/migrations/` | 10.2 → 0010, 10.3 → 0011, 10.4 → 0012, 10.5 → 0013 | number by **merge order**; renumber in the PR if it changes |

Therefore: **one batch per session, one open PR at a time, merge before starting the next.** The only genuinely disjoint pair is 10.1 and 10.3; the contract still recommends sequencing (migration numbering, one reviewer).

## Recommended Execution Order
`10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6a → 10.7`, with 10.6b scheduled after D4 is answered (it may follow 10.3 at any time once unblocked, but must not overlap another batch editing `repository.ts`).
Why this order: state machine first (pure, no data, wraps what exists); the audit log next so every later community action is born logged; limiter before reports because reports are a new anonymous write path that must use the shared limiter from day one; terms before reports because both add a gate to community writes and terms is the smaller change; hardening after features so it covers the new paths; smoke last.

## Per-batch session rule and handoff
- One session implements one batch, on its own branch/PR, wearing architect → backend → frontend hats in sequence; no subagents unless the owner approves one in chat.
- At the end of each batch the session writes a **short handoff** (≤25 lines) to `.claude/contracts/handoff/phase10-<batch>.md`: what merged (PR link), what changed in shared files, migration number actually used, tests run with output, decisions taken, open items for the next batch. The next session reads that note and its own contract, nothing else from chat history.
- `/compact` past ~150k context; `qc`/`security` only when the owner calls them.

## Decisions needed from the project owner
| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | Accept ADR 0019 (currently Proposed) as written | Accept | 10.2, 10.3 |
| D2 | Migration numbering: ADR 0019 line 105 and `specs-community-database` say "`0010` audit events **and** counters"; splitting 10.2/10.3 gives `0010` audit, `0011` counters, `0012` terms, `0013` reports (spec says `0011` = reports + terms + listing states). Update spec numbering in each batch's doc change; leave the ADR text as is (or amend its one sentence on acceptance) | Split as above (no inert schema) | 10.2 |
| D3 | Audit log retention 1 year + sweep | Accept | 10.2 |
| D4 | Privacy policy / `guestKey` retention (P11-D1) is the owner's | Owner supplies; until then 10.6b stays unstarted | 10.6b |
| D5 | Creator Terms: exact text edits (images/video mention, Q8), and the version identifier scheme (explicit `termsVersion` string in `src/content/site.ts`, bumped by the owner) | Explicit version string + a test that fails if text changes without a bump | 10.4 |
| D6 | Which writes require accepted Terms: listing request + signed-in Planner review (guest reviews have no account, so cannot) | Both | 10.4 |
| D7 | Reports: cover trips **and** reviews. Reviews have no public id today (`PublicCommunityReview`, `src/server/planner/schemas.ts:894`); reporting one needs an opaque non-personal id added to the public projection (a pinned projection test changes) | Both, add the opaque id | 10.5 |
| D8 | Batch 10.1 gets no new backlog ID | Agree | — |
| D9 | P10-15: enforce `contributionOpen` on the server | Yes — the gate is already open on `main`, so this is a safeguard against closing it again, not a feature | 10.6a |
| D10 | Real dev-VM proxy config and Cloudflare Tunnel (P10-12), backups/`metadataBase`/HSTS (P10-7) | Owner checks and reports | 10.6a, 10.7 |
| D11 | Run `/sec-check` (after 10.3, after 10.5) and `/qc-check` (after 10.1, at the end) | Yes, on the owner's call only | 10.7 |
| D12 | New short ADR (proposed 0020) for the Terms/Report/limiter-usage details, or fold them into the batch feature docs | Feature docs only, except 10.6b which needs an ADR/addendum (touches ADR 0015's key) | 10.4–10.6 |

Approved. Start with 10.1 in its own session; one batch per session.
