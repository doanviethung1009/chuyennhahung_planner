# Handoff — member-home-tabs (ADR 0032)
- Branch `claude/member-home-tabs-2a2305` (from origin/main 47e9d33). NOTHING committed/pushed, no PR (awaiting owner).
- Owner approved all contract recommendations (default tab Map, link-nav, 3 tabs, D1–D4, docs in member-map.*, sec-check later).
## Done
- `/my-trips?tab=map|trips|share` server-read (`src/lib/member-home-tab.ts`), `MemberHomeTabs` = `<nav>` of real links, `aria-current`, no ARIA tablist; guest: no tab bar, empty map on every tab, MyTrips/panel not mounted.
- `getMemberSession` (identify only) + `getMemberMapShareOverview` (preview + unfinished count) in `src/server/planner/`.
- D1 note + link to trips tab, D2 sparse warning before enable (panel), D3 legend line, D4 neutral `sharedMap.empty`. Messages VI/EN only added keys (+ `sharedMap.empty` copy).
- ADR 0032 EN+VI + README; docs member-map / member-map-sharing EN+VI; architecture EN+VI.
- Tests: tests/member-home-tab.test.ts (new), member-map.test.ts (updated), tests/dom/member-map-share-panel.test.tsx (+2, Link mock handles query).
## Checks (real)
- typecheck PASS; lint PASS; test PASS (124 files, 1522 passed, 4 skipped = Postgres integration, NOT RUN); build PASS.
- Local dev (JSON store, throwaway account): member tab=map/trips/share/zzz and /en ok, guest no tab bar, 308 for /ban-do-cua-toi.
- NOT RUN: browser visual 375/768/1280, no-JS browser, focus after tab click, Postgres; qc; sec-check (recommended).
## Notes
- Unfinished note/sparse warning render client-side after status load (SSR shows loading). Share preview is SSR.
- Dom test: a `screen` query leaked a previous test's DOM; new test uses `within(container)` (cause not investigated).
- e2e selectors: see docs/features/member-map.md "Tabs". Not touched: e2e/**, next.config.ts, routing.ts, return-to.ts.
