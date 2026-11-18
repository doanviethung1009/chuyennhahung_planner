# Core Completion — Task Contract Index
- Created: 2026-11-18, on `main` @ `bb3a026`. Role: system-architect (main session, Single-Agent First, sub-agents 0). Nothing here changes code, a Phase ID or a task ID; no new Phase.
- Owner decision (2026-11-18): finish the core first (UI, API, database, CMS, data, end-to-end flows). DEFERRED: AI Planner, Affiliate, Analytics (Phase 06, P08-4), Social Engagement (Phase 14), Vlog (Phase 13). P10-7 backup and D5 Terms stay in Phase 09.
- Owner approved the proposed order and the six decisions below on 2026-11-18.
- `CORE-n` are session labels for this index only, not backlog IDs. Each maps to an existing task ID.

## Order (one contract = one session = one branch = one PR; start each with `.claude/templates/UNIVERSAL_TASK_EXECUTION.md`)
| Session | Maps to | Contract | State | Gate |
|---|---|---|---|---|
| CORE-0 | roadmap sync (docs only) | this file, section CORE-0 | READY after PR #160 merges | owner approves final wording |
| CORE-1 | P07-17 System status | [admin-ws-p07-17-system-status.md](admin-ws-p07-17-system-status.md) | READY (existing, owner approved 2026-11-17) | none |
| CORE-2 | P07-12 Users & roles | [admin-ws-p07-12-users-roles.md](admin-ws-p07-12-users-roles.md) | READY (existing) | repository cursor method needs architect stop-and-ask |
| CORE-3 | P07-14 Moderation workspace | [admin-ws-p07-14-moderation-workspace.md](admin-ws-p07-14-moderation-workspace.md) | READY; its "blocked until 10.5" is stale (PR #126 merged) | fix that line in CORE-0 |
| CORE-4 | P07-15 Collections + Integrity | [admin-ws-p07-15-collections-integrity.md](admin-ws-p07-15-collections-integrity.md) | READY after contract amendment (W11 approved 2026-11-18) | amend the contract first: handlers move to `adminContentRoute`, class becomes L (`/sec-check` recommended) |
| CORE-5 | P07-6 Template CMS | none yet | DESIGNED — contract to write | W4 decided 2026-11-18: no version history, `If-Match` only; needs W11 handler move from CORE-4 first |
| CORE-6 | UI tests for community components | this file, section CORE-6 | READY | none |
| CORE-7 | P04-2 `/plan-your-trip` | none yet | DESIGNED — contract to write | decided 2026-11-18: link into `/trip-setup`, keep the contact routes for tour booking |
| CORE-8 | end-to-end smoke + `/qc-check` + `/sec-check` | none yet | after the above | user calls the reviews |

Avoid conflicts: CORE-3 edits `src/components/admin/community/**`, CORE-6 adds tests for the same components — run CORE-6 after CORE-3. CORE-2, CORE-3, CORE-4 each touch `src/i18n/routing.ts` and `messages/*.json` — merge one at a time. Only PR open at creation: #160 (two contract files; CORE-0 must start after it merges).

## Owner decisions (2026-11-18)
1. **W11 approved:** collections, integrity and templates handlers move to session access via `adminContentRoute` (done inside CORE-4; amend its contract first).
2. **W4:** no template version history; `If-Match` against overwrite only.
3. **P04-2:** `/plan-your-trip` links into `/trip-setup` and keeps the contact routes.
4. **PLACES-UI-S4 = the audit log UI**, i.e. P07-13 (merged, PR #157). It is not a missing row: CORE-0 fixes S5's dependency wording to point at P07-13.
5. **Phase 11 kept; Phase 12 and 15 DEFERRED** (as proposed). Phase 06, 13, 14 and P08-4 DEFERRED.
6. **Phase 08:** P08-1..3 and P07-18 DEFERRED until the owner supplies real photos (P09-3); P08-4 DEFERRED. Phase IDs and scope stay unchanged; only status and reason are recorded, with date.

Roadmap files are not edited yet; CORE-0 records all of this after PR #160 merges.

---

# Task Contract: CORE-0 Roadmap sync
- Class: S
- Desired outcome / user impact: `CURRENT.md`, `PHASES.md`, `backlog.md` and contract `State:` lines match `main`, and record the owner's core-first decision.
- Scope IN / OUT: IN — mark P07-13 Done (merged #157); fix "ADR 0025 PR #141 not merged" (merged, ADR still Proposed); add Places UI S1/S2/S3/S5 as merged (#152, #153, #155, #159) and update their contract States; fix the stale "blocked until 10.5" line in P07-14; mark Phase 06, 13, 14 and P08-4 DEFERRED with date and reason; set the next-step list in `CURRENT.md` to the order above. OUT — new Phase IDs, renumbering, deleting content, touching P10-7 / D5 / P09-7 (stay Phase 09), any code.
- Evidence: `git log origin/main`, PRs #152–#160, contract `State:` lines, this index.
- Constraints / dependencies: after PR #160 merges; all wording follows the owner decisions above; status changes need evidence (PHASES rule 4).
- Architecture decision / ADR (if needed): none.
- Interface contract (API, types, DB): none.
- Tasks by owner: Architect only.
- File ownership (avoid parallel overlap): `.claude/roadmap/*`, `.claude/contracts/*` State lines only.
- Acceptance criteria / tests: every changed status cites a PR or file; `tests/docs.test.ts` still passes; `typecheck`, `lint`, `test` output stated.
- Security and migration risks: none.
- Rollback approach: revert PR.
- Budget: sub-agents 0.
- State: READY (after #160)
- Feature document owner: none.
- Architecture/usage doc updates needed: none.

---

# Task Contract: CORE-6 UI tests for community components
- Class: M
- Desired outcome / user impact: the report button, Terms acceptance and report queue are covered by tests, closing QC F3, plus a route-level test for the `guest_limit` event.
- Scope IN / OUT: IN — tests for `src/components/reports/*`, `src/components/planner/terms-accept.tsx`, `src/components/admin/community/report-queue.tsx` (pure helpers extracted only if needed), and a `guest_limit` route test. OUT — behaviour changes, new API, a UI-test framework unless the owner approves adding `jsdom`/Testing Library as a dev dependency (vitest currently runs `environment: 'node'`, `tests/**/*.test.ts` only).
- Evidence: `vitest.config.ts`; backlog Phase 10 "QC F2–F4"; `tests/community-reports-routes.test.ts`, `tests/review-limiter-routes.test.ts`.
- Constraints / dependencies: after CORE-3 (same component folder). Open question for the owner: extract logic and test as pure functions (no new dependency, recommended), or add a DOM test environment.
- Architecture decision / ADR (if needed): only if a DOM test dependency is added.
- Interface contract (API, types, DB): none.
- Tasks by owner: FE (tests, helper extraction) / QC review on request.
- File ownership (avoid parallel overlap): `tests/**`, the listed component files only for helper extraction.
- Acceptance criteria / tests: new tests fail when the guarded behaviour is removed; existing `community-*` suites unchanged and green; also fix the "2 h" test name that is really 48 h (QC F4).
- Security and migration risks: none; no production code path changes.
- Rollback approach: revert PR.
- Budget: sub-agents 0.
- State: READY (after CORE-3)
- Feature document owner: none (tests only).
- Architecture/usage doc updates needed: none.
