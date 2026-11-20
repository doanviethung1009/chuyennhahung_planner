# Handoff — member-map-share-hardening (branch fix/member-map-share-hardening)
Scope: sec-check 2a+2b+2c follow-up. M1, L2 + ops notes (L1, L3, L5). Nothing committed/pushed.
- M1: `getSharedMemberMap` no longer calls `snapshot()`. Order: format → digest → store lookup → `digestsEqual` (timingSafeEqual) → `isDisabled` fresh. Any store error → null.
  Store: `PlannerStore.readSharedMapSource?` (Postgres: 3 bound indexed queries in a READ ONLY txn, no cache); `DocumentStore.view?` (memory/JSON, no clone); fallback `snapshot()`. No migration.
- L2: `changeAccountState` ban/delete sets `tokenDigest=null` in the same txn + audit `map_share_off` (actor). unban/restore no longer revive the link. No conflict with restore behaviour (restore only clears deletedAt). ADR 0030 §8 + §6 line updated (EN+VI).
- Docs: runbook.{md,vi.md} operator notes (L1 note: TRUST_PROXY_HEADERS only affects cookie Secure/scheme, NOT the limiter; L3; L5); feature doc updated both langs.
- Tests: tests/member-map-share.test.ts (+8, one changed: restore no longer revives), tests/postgres-planner-store.test.ts (+3), integration case added (NOT RUN: no TEST_DATABASE_URL).
Checks (after npm ci): typecheck PASS; lint PASS; test PASS (122 files / 1507 tests, 4 files skipped = Postgres integration, NOT RUN without TEST_DATABASE_URL, runs in CI); build PASS.
qc NOT RUN. sec-check NOT RUN — recommended (touches public token lookup).
Rollback: revert PR; no schema change. Before merge: wait CI `verify` green. Untouched: pages/routes of #210.
