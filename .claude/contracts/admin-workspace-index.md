# Admin Workspace — Task Contract Index
- Role: system-architect (main session, Single-Agent First). Subagents: 0. Nothing implemented, committed, pushed or deployed by this document.
- Created: 2026-11-17. State of contracts: **mixed — each contract file carries its own `State:`; P07-10, 11, 16, 19 DONE; P07-13, 17 READY (13 blocked); P07-12, 14, 15 not started; P07-18 BLOCKED (Phase 08)** (was: DESIGNED, awaiting approval) (decisions W1–W8 and gates below).
- Sources (referenced, not restated): [specs-admin-workspace](../../docs/specs-admin-workspace.md) (inventory, sitemap, design, gaps), [specs-admin-workspace-impact](../../docs/specs-admin-workspace-impact.md) (DB/API/RBAC, security and QC checklists), [ADR 0020](../../docs/adr/0020-admin-workspace-shell.md) (Proposed), `phase10-index.md`, ADR 0006/0010/0011/0017/0019.
- Phase placement: **no new Phase ID.** Completes Phase 07. Task IDs are proposed backlog rows `P07-10`…`P07-18` (next free after `P07-9`).
- Phase 10 is untouched: its batches keep their IDs, scope, order and one-PR-at-a-time rule. `feat/submission-state-machine` (batch 10.1) is on a branch with no PR; it is not this work's concern.

## Feature breakdown
| Task ID | Feature | Contract | Branch (proposed) | Class | Migration | Status of the area |
|---|---|---|---|---|---|---|
| P07-10 | Admin shell: layout, sidebar, breadcrumbs, `/admin/users` move | [admin-ws-p07-10-shell.md](admin-ws-p07-10-shell.md) | `feat/admin-shell` | L (route change) | none | Improvement/Missing |
| P07-19 | Admin UX refinement: own root layout, top bar, `AdminPageHeader`, sidebar polish (ADR 0023) | [admin-ws-p07-19-ux-refinement.md](admin-ws-p07-19-ux-refinement.md) | `feat/admin-ux-refinement` | L (route tree, one PR) | none | Improvement (after P07-10 review) |
| P07-11 | Dashboard | [admin-ws-p07-11-dashboard.md](admin-ws-p07-11-dashboard.md) | `feat/admin-dashboard` | M | none | Missing |
| P07-12 | Users & roles: matrix, unlink Google, rotate token, pagination | [admin-ws-p07-12-users-roles.md](admin-ws-p07-12-users-roles.md) | `feat/admin-users-roles` | M | none | Improvement/Missing |
| P07-13 | Audit viewer + admin event kinds | [admin-ws-p07-13-audit-viewer.md](admin-ws-p07-13-audit-viewer.md) | `feat/admin-audit-viewer` | L (new action) | ≤1 index | Missing (storage Planned: 10.2) |
| P07-14 | Moderation workspace | [admin-ws-p07-14-moderation-workspace.md](admin-ws-p07-14-moderation-workspace.md) | `feat/admin-moderation-workspace` | M | none | Improvement (reports Planned: 10.5) |
| P07-15 | Collections + Integrity screens | [admin-ws-p07-15-collections-integrity.md](admin-ws-p07-15-collections-integrity.md) | `feat/admin-collections-integrity` | M (L if handlers move) | none | Missing (APIs exist but token-only → BLOCKED on handler amendment, owner W11) |
| P07-16 | Create + archive story/place in browser | [admin-ws-p07-16-content-create-archive.md](admin-ws-p07-16-content-create-archive.md) | `feat/admin-content-create` | L (new write routes) | none | Missing — **Done** (PR #131) |
| P07-17 | System status page | [admin-ws-p07-17-system-status.md](admin-ws-p07-17-system-status.md) | `feat/admin-system-status` | M | none | Missing |
| P07-18 | Media slot (reservation only) | [admin-ws-p07-18-media-slot.md](admin-ws-p07-18-media-slot.md) | none | S | none | Planned: Phase 08 |

Not contracted: template editor and versioning (`P07-6`, owner decision W4); MFA (`P07-D1`, deferred); backups and production (Phase 09, `D10`); reports queue, events, state machine (Phase 10).

## Dependency matrix
Rows depend on columns (● hard, ○ soft).
| | ADR 0020 | P07-10 | 10.2 | 10.5 | P07-13 |
|---|---|---|---|---|---|
| P07-10 | ● | | | | |
| P07-19 | ● | ● | | | |
| P07-11 | ● | ● (and P07-19) | ○ activity card | | |
| P07-12 | ● | ● | ○ | | |
| P07-13 | ● | ● | ● | ○ (events from 10.4/10.5) | |
| P07-14 | | ● | ○ history | ● reports section | |
| P07-15 | | ● | | | |
| P07-16 | | ● | | | ○ (events) |
| P07-17 | | ● | | | |
| P07-18 | | ● | | | |

**Path mapping after P07-19 (owner W-UX, ADR 0023).** The admin pages move to `src/app/(admin)/[locale]/admin/**`; URLs are unchanged. Wherever P07-11…P07-17 or Phase 10.5 name `src/app/[locale]/admin/**`, read `src/app/(admin)/[locale]/admin/**`, and use `AdminPageHeader` instead of `PageHeader`. Those contracts are not edited.

## File-conflict map (no two sessions edit one file at once)
| File | Edited by | Order |
|---|---|---|
| `src/app/[locale]/admin/**/page.tsx` (existing) | P07-10 (wrap + move), 10.5 and P07-14 (`community/page.tsx`) | P07-10 before 10.5; P07-14 after 10.5 |
| `src/components/admin/admin-nav.tsx` | P07-10 only (replaced) | — |
| `src/app/[locale]/admin/**` → `src/app/(admin)/[locale]/admin/**`, `admin-sidebar.tsx`, `admin-console.tsx` (sign-out row), `src/app/[locale]/layout.tsx` (fonts import), `globals.css` (`--admin-bar-h`) | P07-19 only | P07-19 before P07-11, 10.5 and P07-14 |
| `src/i18n/routing.ts`, `src/lib/return-to.ts`, `tests/admin-portal.test.ts`, `tests/return-to.test.ts` | P07-10, then each feature adding a route | sequential |
| `src/server/identity/permissions.ts`, `tests/planner-roles.test.ts` | P07-13 only | — |
| `messages/vi.json`, `messages/en.json` | every feature, plus Phase 10 batches 10.4, 10.5 | sequential, **one open PR at a time** |
| `docs/architecture.*`, `docs/features/README.*`, `docs/README.*`, `docs/runbook.md` | every shipping feature | sequential |
| `src/server/planner/repository.ts`, `schemas.ts`, `store.ts` | Phase 10 only; none of P07-10…18 edits them (read via existing methods) | — |
| `src/app/api/admin/travel/{stories,places}/route.ts` | P07-16 only | — |

Therefore: **one feature session at a time, one open PR at a time** across Phase 10 and this work. Nothing here is genuinely parallel with a Phase 10 batch because of `messages/*.json` and the docs files.

## Recommended execution order
`10.1 (merge as is) → P07-10 → P07-19 → 10.2 → P07-11 → 10.3 → 10.4 → 10.5 → P07-14 → P07-13 → P07-12 → P07-15 → P07-17 → P07-16`, `P07-18` blocked until Phase 08 starts.
Why: the frame first because every later screen plugs into it and it touches no data; 10.2 next because the audit log is Phase 10's job and is the hard prerequisite of the viewer; the dashboard right after 10.2 so its activity card is real; moderation workspace after 10.5 so it designs around reports once; viewer after 10.5 so it covers terms and report events in one pass; users/roles, collections and system are independent read-mostly screens; create/archive last among these because it adds write routes (largest risk) and benefits from the audit viewer existing.
If the owner prefers to finish Phase 10 first, the order collapses to `10.1 → … → 10.7`, then `P07-10 → P07-11 → …` unchanged.

## Session Execution Plan
Rules (from the request, restated once):
1. **Architect session** (this one): analysis, spec, contracts, dependencies, acceptance criteria, reviews of hand-offs. It writes no application code.
2. **One new Claude session per feature**, started by the owner (or on the owner's yes), on the contract's branch. It reads **only**: `CLAUDE.md`, its contract, the sources the contract lists, the previous handoff note if the contract names one. No repository-wide scan.
3. A feature session does one contract. It does not widen scope, start another feature, spawn sub-agents (Single-Agent First; a sub-agent is proposed in chat and waits for the owner's yes), or merge its PR.
4. Pipeline per feature: Architecture Review (done here) → Specification (done here) → Task Contract (done here) → **Architecture Approval (owner)** → new session → implementation → focused tests → `/qc-check` + `/sec-check` when the owner calls them → PR → Architect review → **Merge approval (owner)** → docs and roadmap update (written by the feature session in its PR; the roadmap edit applies the proposal below).
5. Approval is mandatory before any session that changes the database, authorization, public API or an important route: `P07-10` (route), `P07-13` (action, maybe index), `P07-16` (write routes). Others need the owner's go on the contract, not a design review.
6. Handoff note, ≤25 lines, `.claude/contracts/handoff/admin-<task-id>.md`: PR link, files changed outside the plan, tests run with output (or NOT RUN), decisions taken, open items. The next session reads that note and its contract only.
7. Test economy: focused tests (`npx vitest run <files>`) while working; the full `typecheck` + `lint` + `test` once at the integration gate, `build` before the PR.
8. `/compact` past ~150k context; Sonnet is enough for every contract; Opus only if the owner asks.

Start prompt for a feature session (the owner pastes it into a new session on the branch):
> You are the feature session for Task `<ID>`. Read `CLAUDE.md` and `.claude/contracts/admin-ws-<file>.md` and the sources it lists; nothing else unless the contract points to it. Implement only that contract on its branch. No sub-agents, no extra scope, no merge. Finish with a handoff note and the PR.

## Roadmap Update Proposal (not applied)
`.claude/roadmap/PHASES.md` §Phase 07 — keep ID, status and scope; append one bullet: "Admin Workspace (proposal 2026-11-17): shell, dashboard, users/roles screens, audit viewer, moderation workspace, content screens, system status — tasks `P07-10`…`P07-18`; see `admin-workspace-index.md`. Depends on Phase 10 batches 10.2 and 10.5 for the audit viewer and the reports section." Phase 08 §Phạm vi: one line "admin entry reserved by `P07-18`". The "Thứ tự đề xuất" line (05 → 07 → 10 → …) does not change: Phase 07's remaining work is interleaved with Phase 10 as above.
`.claude/roadmap/backlog.md` §Phase 07 — append rows:
| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P07-10 | Admin shell: layout, sidebar, `/admin/users` (ADR 0020) | FE | ADR 0020 |
| P07-11 | Dashboard `GET /api/admin/overview` | BE + FE | P07-10 |
| P07-12 | Users & roles: ma trận, gỡ Google, rotate token, phân trang | BE + FE | P07-10 |
| P07-13 | Audit viewer + `audit:read` + sự kiện admin | BE + FE | P10-1 (10.2), P07-10 |
| P07-14 | Moderation workspace | FE | P07-10, P10-3 (10.5) |
| P07-15 | Màn Collections + Integrity | FE | P07-10 |
| P07-16 | Create + archive story/place trên trình duyệt | BE + FE | P07-10, W5 |
| P07-17 | System status `GET /api/admin/system` | BE + FE | P07-10, D10 |
| P07-18 | Chỗ Media trong admin | FE | P08-2 (bị chặn) |
`CURRENT.md`: no change until a feature session starts. `P07-4` (audit log) stays owned by Phase 10 (`P10-1`); `P07-13` consumes it.

## Decisions needed from the project owner
| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| W1 | `/admin` → dashboard, users → `/admin/users` (ADR 0020 Accepted) | Yes | all |
| W2 | New action `audit:read` (admin, super admin, service) | Yes | P07-13 |
| W3 | System page reuses `runbook:read` | Yes | P07-17 |
| W4 | Template editing/versioning | Decide later; not contracted | — |
| W5 | Browser create + archive; hard delete stays token-only | Yes | P07-16 |
| W6 | Media hidden until Phase 08 | Yes | P07-18 |
| W7 | Users pagination, default 50 | Yes | P07-12 |
| W8 | Confirm DEV commit and walk the authenticated admin once | Do before P07-10 acceptance | P07-10 |
| W9 | Execution order above, or finish Phase 10 first | Interleave as listed | start of work |
| W11 | Move collections and integrity handlers to session-capable `adminContentRoute` (they are token-only today) | Yes, same pattern as ADR 0011 | P07-15 |
| W10 | `/sec-check` after P07-13, P07-16, P07-17; `/qc-check` at the end | Yes, on the owner's call only | — |

Approved. Start with P07-10 in its own new session, after 10.1 merges.
