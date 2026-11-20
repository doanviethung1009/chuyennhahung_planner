# Handoff — member-home-merge (ADR 0031)
- Branch: `feat/member-home-merge` (from origin/main 85cfeff). Nothing committed, no PR (awaiting owner). ADR 0031 approved by owner in chat.
- Contract `.claude/contracts/member-home-merge.md`; ADR 0031 EN+VI.
## Done
- `/my-trips` is now a server page (force-dynamic, noindex): `MemberMapView` above, `MyTrips` below under h2 `myTrips.listTitle`; guest gets the empty map + sign-in, `MyTrips` not mounted.
- `/my-map` removed (page, `pathnames`, `return-to`, account menu, `nav.myMap`, `myTrips.mapLink`); 308 redirects `/ban-do-cua-toi`→`/chuyen-di-cua-toi`, `/en/my-map`→`/en/my-trips`; private no-store paths moved (`memberMapPaths`).
- Tests: member-map.test.ts (redirects, guest list not mounted, boundary), member-map-view returnTo. Docs EN+VI: ADR 0031 + README, feature member-map, architecture, features README.
## Checks (real)
- typecheck: only errors in `tests/dom/*` (missing @testing-library in shared node_modules; pre-existing/env). lint: clean. test: 1417 passed, 8 errors = jsdom missing (dom tests NOT RUN). build: webpack compile OK; type-check step fails on same tests/dom deps; Turbopack fails via symlinked node_modules. Dev server (webpack): redirects 308 OK; guest page 200, one h1, sign-in link, no list.
- Browser 375/768/1280: NOT RUN. qc, sec-check: NOT RUN (sec-check recommended).
## Risks / Next
- Rebased onto main with 2c (#208): share panel now rendered in `my-trips/page.tsx`; `my-map/page.tsx` deleted.
- ADR 0029/0030 text still says `/my-map` historically; ADR 0031 amends it.
