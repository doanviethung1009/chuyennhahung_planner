# Handoff — member-map slice 2b (public page)
- Branch: `feat/member-map-shared-page` (from origin/main 2692c10). PR: not opened, nothing committed (awaiting owner).
- Contract `.claude/contracts/member-map.md` (PR #200), ADR 0030, handoff 2a.
## Done
- Page `/shared-map/[token]` (VI `/ban-do-chia-se/[token]`): force-dynamic, page only, generic noindex/no-referrer metadata, h1 + map + list, i18n `sharedMap` VI+EN.
- `src/server/planner/shared-map-page.ts`: `loadSharedMemberMap` (limiter, repo, errors → one `null` → `notFound()`), `sharedMapDestinations` (bucket → pin size 1/2/4; unknown slug dropped).
- `next.config.ts` `mapSharePaths` (no-store, noindex, no-referrer); robots disallow; not in sitemap.
- nginx: `access_log … if=$cnh_loggable` off for both paths, redaction map extended, no cache; runbook EN+VI says VM NOT verified.
- Tests: `tests/member-map-shared-page.test.ts`; updated deploy-config, home-page-boundary, admin-portal tests. Docs EN+VI: feature doc, architecture, deploy-operations.
## Checks
see final report. qc NOT RUN · sec-check NOT RUN (recommended: public page takes a bearer token from URL).
## Risks
- Slice 1 (#201) merged; branch fast-forwarded to origin/main 60bc15b. The page passes `MapPin[]` (only slug, name, coords, featured, labelSide, visits).
- Page not rendered in a browser here; nginx on the real VM not checked; `name` mode still closed.
## Next
2c controls/preview on `/my-map` · `/sec-check` on 2a+2b · owner applies nginx config.
