# Task Contract: P07-14 Community moderation workspace
- Class: M · Branch: `feat/admin-moderation-workspace` · Depends on: P07-10, **batch 10.5 merged** (it edits the same page); soft on 10.2 · Index: [admin-workspace-index.md](admin-workspace-index.md)
- Desired outcome: `/admin/community` reads as one triage workspace: counts per section, fixed order (pending trips → pending reviews → held → reports → restrictions), per-item history link when 10.2 exists.
- Scope IN: section header with counts and anchors, empty states, consistent action layout across `listing-queue`, `review-queue`, `restriction-list` and the reports list added by 10.5; history drawer/link using `GET /api/admin/community/events?targetId=` if present.
- Scope OUT: any moderation rule, state machine, report logic, new API, new route (the URL stays), restrictions behaviour.
- Evidence: `src/app/[locale]/admin/community/page.tsx:38-65`, `src/components/admin/community/*`, contracts 10.2 and 10.5.
- Files allowed: `src/app/[locale]/admin/community/page.tsx`, `src/components/admin/community/**`, `messages/*.json`, tests, `docs/features/admin-moderation-workspace.*`, `docs/features/README.*`. Anything in `src/server/**` → ask.
- Acceptance: no behavioural change to any queue action (same requests, same results); counts match list lengths; `canRestrict` gating unchanged; keyboard order follows reading order; one `<h1>`.
- Tests: component-level logic extracted to pure helpers (counts, ordering) and unit tested; existing `community-*` and `review-restrictions-routes` suites unchanged and green; i18n.
- Security: presentation only; no new data exposed. Rollback: revert PR. Budget: sub-agents 0. State: READY (owner approved 2026-11-17); the 10.5 dependency is met (PR #126 merged 2026-11-17).
