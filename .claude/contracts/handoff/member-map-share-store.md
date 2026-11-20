# Handoff — member-map slice 2a (store, migration, owner API)
- Branch: `feat/member-map-share-store` (from origin/main 8adda36). PR: not opened, nothing committed (awaiting owner).
- Contract: `.claude/contracts/member-map.md` (PR #200), ADR 0030 (merged).
## Done
- Table `member_map_shares` (migration `0016`, rollback file), JSON/Postgres mapping, store key `memberMapShares`.
- `src/server/planner/member-map-share.ts`: token (43 chars), SHA-256 digest, name guard, buckets 1/2–3/4+, `PublicMemberMap` projection.
- Repository: get/set/rotate/revoke share, `getSharedMemberMap(token)` (for 2b), `deleteUser` cascade, audit `map_share_*`.
- API `GET/PUT/DELETE /api/planner/map/share`, `POST …/rotate`; own limiter `memberMapShare` 20/h; public-read limiter defined for 2b.
- Export drops digest; import resets to no token + anonymous. Docs EN+VI: feature doc, features README, architecture, runbook rows.
## Outside plan
- `tests/planner-pg-fixtures.ts` scenario now enables a share; `tests/planner-rows.test.ts` and `planner-transfer.test.ts` updated for the new table/digest rule.
- Separate feature doc `member-map-sharing.*` (slice 1's `member-map.*` is not on main).
## Checks
typecheck PASS · lint PASS · test PASS (116 files, 1437 tests; 95 skipped = no TEST_DATABASE_URL) · build PASS · qc NOT RUN · sec-check NOT RUN (recommended).
## Risks
- `name` mode closed (`share_name_unavailable`) until `profilePublicOpen` exists; 422 path tested via injected option.
- Postgres round trip of the new table NOT RUN (needs TEST_DATABASE_URL). Migration not applied anywhere.
- Migration number 0016 may clash with ADR 0025's reserved 0016/0017: renumber at merge order.
## Next
2b public page + nginx rule (verify VM) · 2c controls/preview · `/sec-check` on 2a+2b.
