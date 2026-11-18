# ADR 0027 — Component test stack: jsdom + Testing Library, opt-in per file

🇻🇳 Bản tiếng Việt: [0027-component-test-stack.vi.md](0027-component-test-stack.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-19
- **Owner:** system-architect
- **Affects:** `package.json` (dev dependencies), `vitest.config.ts`, `tests/dom/**`. No production code, API or data change. Task Contract `CORE-6`; owner decision 9 (2026-11-18).

## Context

Vitest ran `environment: 'node'` on `tests/**/*.test.ts` only, so nothing exercised the interactive community components (report button, Terms acceptance, report queue). QC finding F3 recorded that gap. A DOM is needed; the end-to-end browser layer is a separate, later decision (Playwright, `WEB-3`).

## Decision

1. **Stack.** `jsdom` as the DOM, `@testing-library/react` for rendering and `@testing-library/user-event` for interaction, as **dev dependencies** only. Nothing is added to the production bundle.
2. **Opt-in per file.** The default stays `environment: 'node'`. A component test is a `.test.tsx` file whose first line is `// @vitest-environment jsdom`; every existing `.test.ts` suite is untouched and keeps running in Node. `include` becomes `tests/**/*.test.{ts,tsx}`.
3. **Real messages, real `api()`.** Components render under `NextIntlClientProvider` with the real `messages/*.json`, so a missing key fails the test. The network is a `fetch` stub, so the real `api()` wrapper (status, error code, `Retry-After`) is exercised; components are not mocked. Shared helpers live in `tests/dom/helpers.tsx`.
4. **Known jsdom gaps are modelled in the helper, not the component.** jsdom has no modal `<dialog>`; `polyfillDialog()` sets and removes `open`. `server.deps.inline: ['next-intl']` lets Vite resolve its `next/navigation` import.
5. **Scope.** Behaviour a user or moderator relies on (what is sent, what is disabled, what is announced), not styling or snapshots. A new component test must fail when the behaviour it guards is removed.

## Options considered

- **happy-dom** — faster, but weaker on `<dialog>` and form semantics; no gain worth a second DOM.
- **Playwright component testing** — real browser, but a heavier toolchain and a second runner; Playwright is reserved for end-to-end (`WEB-3`).
- **Extract pure helpers only** — already done where it helps (`workspace-model.ts`); it cannot cover focus, dialogs or request wiring.

## Consequences

- `npm run test` now also runs component tests; they add a few seconds.
- A new component test needs one docblock line and the shared helpers.
- jsdom is not a browser: layout, focus trapping and real `<dialog>` behaviour still need `WEB-3`.
