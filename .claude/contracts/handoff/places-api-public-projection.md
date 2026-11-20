# Handoff — PLACES-API-PROJ (2026-11-19)
- Branch `fix/places-api-public-projection` (from main abd54ef). NOT committed, NOT pushed, no PR (awaiting owner permission).
- Owner approved option A: public places API = ADR 0026 allow-list; `coords` dropped too.
- Code: `src/server/content/public-places.ts` (export `toPublicPlace`, not moved → no clash with places-load-hardening), `src/app/api/travel/places/route.ts`, `.../[slug]/route.ts` (map through `toPublicPlace`). Admin routes untouched.
- Test: `tests/places-api-public-projection.test.ts` (list + detail: exact key set, no affiliate/timestamps/coords, values intact, destinationSlug/category/limit/offset/q unchanged, 404). Note: its 3rd case only checks the repository keeps the full record; admin route coverage stays in `travel-content-api.test.ts`.
- Docs: `docs/travel-content-api.*`, ADR 0026 amendment (EN+VI, number unchanged), `docs/features/places.*`; contract `.claude/contracts/places-api-public-projection.md`.
- Checks: test PASS for 103 files / 1302 tests (91 skipped) incl. docs.test.ts; lint PASS (no output); typecheck FAIL: 10 errors, ALL in tests/dom/* (`@testing-library/*` not installed); no error in changed files. `vitest` also logs 5 unhandled "Cannot find package 'jsdom'" errors (same cause). Build: FAIL in this worktree (Turbopack: root/node_modules resolution; `next build --webpack` compiles then fails type-check on the same tests/dom errors). All environmental: this worktree's node_modules lacks devDeps. Not re-run on clean main to confirm; run `npm install` in an env with devDeps, then re-run typecheck + build.
- qc: NOT RUN. sec-check: NOT RUN (recommended: public data exposure).
- Breaking only for external clients reading affiliateLinks/createdAt/updatedAt/coords. Rollback: revert PR.
- Next: owner OKs commit/PR; fix env deps and confirm typecheck/build green.
