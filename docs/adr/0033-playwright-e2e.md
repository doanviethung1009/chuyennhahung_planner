# ADR 0033 — End-to-end smoke tests with Playwright

🇻🇳 Bản tiếng Việt: [0033-playwright-e2e.vi.md](0033-playwright-e2e.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-21
- **Owner:** system-architect
- **Affects:** `playwright.config.ts`, `e2e/**`, `tests/e2e-guard.test.ts`, `package.json` (`@playwright/test`, `e2e` scripts), `.github/workflows/e2e.yml`, `.gitignore`, `eslint.config.mjs`, `docs/usage.*`, `docs/architecture.*`. Task Contract `web-3-playwright-e2e`. Builds on [ADR 0027](0027-component-test-stack.md) ("Playwright is reserved for end-to-end").

## Context

The core flows (trip from a template, sharing, reviews, community moderation, the admin portal, sign-in, the member map) were checked by hand in the CORE-8 smoke (`.claude/reports/core-8-smoke-2026-11-19.md`). A regression in any of them waited for the next manual smoke. Unit and component tests (Vitest, jsdom — ADR 0027) cannot see routing, cookies, the same-origin check, response headers or two browsers racing on one record.

The owner decided (decision 9, 2026-11-18) that Playwright is its own PR, that E2E never uses the production database or the dev VM, and that it runs against a throwaway store seeded by the run itself.

## Decision

1. **`@playwright/test` 1.64.1** (exact pin, published 2026-10-14) as a dev dependency; config in `playwright.config.ts`; specs in `e2e/` (not `tests/`, so Vitest keeps `include: tests/**`); `npm run e2e`.
2. **The production build is the server under test**, started the way the Dockerfile does: `output: standalone`, so `e2e/support/serve.mjs` copies `.next/static` and `public` into `.next/standalone` and runs `server.js`. The server binds `HOSTNAME=localhost` on a free port; the base URL is `http://localhost:<port>`. (`next start` is unsupported with `standalone`, and binding `127.0.0.1` makes Next treat the next-intl rewrite of `/` as external and redirect-loop every unprefixed Vietnamese URL.)
3. **A throwaway store per run:** `PLANNER_STORE` and `TRAVEL_CONTENT_STORE` point into `.data/e2e/<run-id>/` (git-ignored, deleted by `global-teardown.ts`). The content store auto-seeds the demo stories, places and templates on first use; nothing else is seeded. `PLANNER_DATABASE_URL`, `CONTENT_DATABASE_URL` and the Google variables are blanked for the server, so a developer's `.env.local` cannot route it to a real database.
4. **Secrets are generated per run** with `crypto.randomBytes` (`ADMIN_API_TOKEN`, `GUEST_KEY_SECRET`, every account password), kept in `process.env` and `.data/e2e/<run-id>/`, never printed or committed.
5. **A safety guard that cannot be switched off** (`e2e/support/guard.ts`, run by the config and again by `global-setup.ts`, covered by `tests/e2e-guard.test.ts`): the base URL must be `localhost`, `127.0.0.1` or `[::1]`; every database URL in the environment (`PLANNER_DATABASE_URL`, `CONTENT_DATABASE_URL`, `E2E_DATABASE_URL`) must be a local host and a database whose name contains `e2e` or `test`; an `E2E_*` variable naming the dev VM is refused. There is no override flag. PostgreSQL is opt-in (`E2E_DB=postgres` with `E2E_DATABASE_URL`) and not run in CI in v1.
6. **Accounts go through the app's own paths:** `global-setup.ts` creates a member, a second member, an editor, an admin, a super admin and a staff `gate` account with the service token (`POST /api/admin/planner/users`), exchanges each temporary password for a random one through `POST /api/planner/password`, and stores one `storageState` per role. The `gate` account keeps its temporary password so a spec walks the forced password change as a real step.
7. **Specs** are tagged `@smoke`, use roles and labels (no `data-testid`, no product change), no fixed sleeps, `workers: 1`, `fullyParallel: false`, `trace: 'retain-on-failure'`. Each test sends its own `x-forwarded-for`, so the per-IP sign-in limiter (10 a minute) never throttles the suite.
8. **Browsers:** locally the installed Google Chrome (`channel: 'chrome'`, no download); in CI Chromium only, installed with `npx playwright install --with-deps chromium`. No Firefox or WebKit.
9. **CI:** a separate workflow `e2e.yml` (own `paths` filter, `pull_request` and `push` to `main`, `workflow_dispatch`), advisory like `CI`. The report and traces are uploaded only on failure, kept 7 days.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): Playwright against the production build and a JSON store per run | Tests the real artifact, isolated, no database to provision, runs the same locally and in CI | Another dev dependency and a browser binary in CI; a second runner beside Vitest |
| B: extend jsdom component tests | No new dependency | Cannot see routing, cookies, headers, redirects or two sessions |
| C: PostgreSQL in CI from day one | Closer to production | Slower, a database lifecycle to manage; the JSON store is enough for v1 (Q2) |
| D: puppeteer-core (already used by `verify:ui`) | No new dependency | No test runner, no web-first assertions, no traces |

Runner-up: B, which loses because the flows that regress are exactly the ones a DOM simulation cannot reach.

## Consequences

- Easier: a regression in a core flow fails a check. The suite documents the contracts it asserts (noindex on share pages, the 308 tour redirects, the `If-Match` conflict, who may DELETE).
- Harder: a new dev dependency (reviewed through the lockfile diff and `npm audit`), a CI job that downloads Chromium from the Playwright CDN, and a suite to maintain when a label changes (selectors use visible Vietnamese labels, so a copy change is a test change). Locally it needs Google Chrome.
- The suite runs on the JSON store only, so a PostgreSQL-only defect is not covered here (the Vitest PostgreSQL suites cover the repositories).
- Reverse by reverting the PR: config, `e2e/`, workflow and dependency.

## Follow-up

- `docs/usage.*` ("End-to-end tests") and `docs/architecture.*` ("Verification") updated in the same change.
- A second job on the CI PostgreSQL service once the flows are stable (Q2).
- Run `/sec-check` (new dependency, CI change, credential handling in setup).
