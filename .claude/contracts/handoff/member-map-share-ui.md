# Handoff — member-map slice 2c (controls + preview on /my-map)
- Branch: `feat/member-map-share-ui` (from origin/main 85cfeff). PR: not opened, nothing committed (awaiting owner).
- Contract `.claude/contracts/member-map.md`, ADR 0030 §7, handoffs 2a/2b/slice 1.
## Done
- `MemberMapSharePanel` (client) on `/my-map` for signed-in members: enable, revoke, rotate (inline confirm), one-time link + copy button, name radios, 401/403/422/429/409/500 messages (`role=alert`/`status`), token only in React state.
- `MemberMapSharePreview` (server) + `resolveMemberMapSharePreview`: the public projection via `buildPublicMemberMapPoints` + `sharedMapDestinations`; anonymous name line; sparse (<2) warning. Reuses `VietnamMap`; `destinations.ts` untouched.
- i18n `memberMapShare` VI+EN; docs EN+VI: feature doc `member-map-sharing.*`, features README rows. `docs/usage.*` has no `/my-map` section, so not touched.
## Outside plan
- `allTrips` in `member-map.ts` now exported (no behaviour change). API/store/migration of 2a unchanged; contract had no gap.
## Checks
typecheck PASS · lint PASS · test PASS (122 files, 1496 tests, 95 skipped = no TEST_DATABASE_URL; 24 new) · build PASS.
- Browser (dev server, JSON store, seeded member): 375/768/1280 no horizontal overflow; enable shows link once (focus on its heading), buttons 44px; rotate asks first; name radio → 403 disables it and stays anonymous; reload: link gone, token not in HTML/storage/URL; preview lists only completed trips (planned Sa Pa absent); public link returns 200; guest HTML has no panel. Console 401s were pre-cookie loads.
- qc NOT RUN · sec-check NOT RUN (recommended: one-time bearer link in UI).
## Risks
- Preview adds a second trips read on `/my-map`. Two tabs can show stale on/off until reload.
- nginx on the real VM still unverified; Postgres round trip NOT RUN; clipboard fallback not tested on plain http.
## Next
Owner OKs commit/PR → CI `verify` green before merge · `/sec-check` 2a+2b+2c · owner applies nginx rule and checks VM.
