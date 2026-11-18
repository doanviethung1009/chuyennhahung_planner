# Handoff — CORE-6 UI tests for community components
- Branch: `test/community-component-tests` (from `main` @ 815f269, after #166). PR: [#167](https://github.com/doanviethung1009/chuyennhahung_planner/pull/167) — open, not merged.
## Done
- Dev deps: `jsdom`, `@testing-library/react`, `@testing-library/user-event`.
- `vitest.config.ts`: `include` → `*.test.{ts,tsx}`; `server.deps.inline: ['next-intl']`. Default env stays `node`; component tests opt in with `// @vitest-environment jsdom`.
- `tests/dom/helpers.tsx` (intl provider with real messages, `fetch` stub, `<dialog>` polyfill) + `report-button` (11), `terms-accept` (6), `report-queue` (11 incl. workspace nav count) tests.
- `tests/guest-limit-route.test.ts` (1; env restored, hashed key asserted absent): 11th guest post → 429 and exactly one `guest_limit` event, no IP in events/queue.
- QC F4: `tests/postgres-rate-limiter.integration.test.ts` name "(2 h)" → "(48 h)" (retention is 48 h; integration suite is skipped without TEST_DATABASE_URL).
- ADR 0027 (EN+VI) registered in `docs/adr/README*`; `docs/usage*` test row links it.
## Outside the plan
- None in production code. No helper extraction was needed.
## Checks
- typecheck PASS; lint PASS (no output); test PASS: 97 files passed | 3 skipped, 1217 passed | 89 skipped.
- Mutations (each reverted, `git status` clean of src changes): removed `disabled={busy}` on report submit → 1 fail; removed 401 handling in terms POST → 1 fail; resolve threshold `<3` → `<0` → 1 fail; removed `recordGuestReviewLimitHit` call in the route → 2 fail.
- `npm run build`: NOT RUN (no route/config-for-build change). `/qc-check`, `/sec-check`: NOT RUN.
## Risks
- jsdom is not a browser: real focus trap/Escape/backdrop of `<dialog>` is modelled, not tested (WEB-3).
- `npm install` printed an npm audit notice (not inspected); no `audit fix` run.
## Next
- Owner: review and merge #167. Then CORE-4.
