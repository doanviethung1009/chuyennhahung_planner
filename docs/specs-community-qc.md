# Community Platform spec — QC

🇻🇳 Bản tiếng Việt: [specs-community-qc.vi.md](specs-community-qc.vi.md)

Status: **Proposed**. Labels **[C] [P] [A]**: see
[specs-community-overview.md](specs-community-overview.md). No test is written by this
document. The independent `qc` reviewer is **NOT RUN** and runs only when the owner asks
(`/qc-check`).

## Goals and scope

Say how each phase is proven done: the test strategy, the acceptance criteria per phase and
the regression net that must stay green. The deterministic checks are the gate; review is
on demand. [C]

## Requirements

- **Q1** A phase is done only when `npm run typecheck`, `npm run lint` and `npm run test`
  pass **and their output is stated**; a check not run is reported NOT RUN, never PASS. [C]
- **Q2** Every new store behaviour is tested through **both** stores (JSON file and
  PostgreSQL adapter), as ADR 0014 required for its migrations. [C]
- **Q3** Every new public projection has an enumerating allow-list test. [C]
- **Q4** Every new string passes `tests/i18n.test.ts`; every new document passes
  `tests/docs.test.ts`. [C]
- **Q5** New tests are written in Vitest (`vitest ^3`); no new test framework. [C]
- **Q6** Fixtures contain no real personal data, and no real handle, phone or email. [C]

## Design

### Strategy

| Level | What | Where (proposed names) |
|---|---|---|
| Unit, pure | `submission.ts` transitions, `scoreMatch`, clone allow-list, cursor encode/decode, video URL parser | `tests/community-submission.test.ts`, `tests/community-clone.test.ts`, … |
| Repository | Operations over both stores, uniqueness, idempotency, soft-delete, anonymity | `tests/community-repository.test.ts` |
| API | Route × caller matrix, envelope, `If-Match`, rate limit, gate closed | `tests/community-api.test.ts` |
| Media | Adapter contract, fixtures (polyglot, truncated, oversize, GPS), signed URL expiry | `tests/community-media.test.ts` |
| Security | XSS corpus, ownership `404`, anonymity enumeration, CSRF, client-boundary | `tests/community-security.test.ts` |
| UI | i18n parity, tokens, client boundary; `npm run verify:ui` screenshots at 375, 768, 1280 | existing suites plus screenshots |
| Manual | Keyboard-only path, screen reader pass on editor and dialogs, mobile Safari upload | checklist in the feature document |

### Regression net (must stay green in every phase)

From `.claude/context/project-context.md`: `tests/i18n.test.ts`, `tests/docs.test.ts`,
`tests/design-tokens.test.ts`, `tests/routing.test.ts`, `tests/content.test.ts`,
`tests/client-boundary.test.ts`, `tests/security-headers.test.ts`,
`tests/planner-roles.test.ts`, `tests/admin-content-session.test.ts`,
`tests/planner-password.test.ts`, `tests/planner-google.test.ts`, the Travel Content
suites, and the existing community trip and review tests. Stages 5 and 6 behaviour and
Phase 07 are asserted unchanged by these.

### Acceptance criteria by phase

| Phase | Given / When / Then |
|---|---|
| C1 | Given the state machine, when every pair of states is tried, then only the diagram's edges succeed and the rest return `invalid_state`. Given legacy `listing` rows, when read, then they map to `pending/published/rejected` and nothing is lost. Given two simulated instances, when one hits a limit, then the other sees it. |
| C2 | Given a published trip, when a member uses it, then they get a private draft owning its own rows with `origin`, and the source is unchanged byte for byte. Given an anonymous author, when copied or listed, then no author appears anywhere. Given a withdrawn source, when copies are read, then they are intact. |
| C3 | Given a JPEG with GPS, when uploaded, then the stored variants have no metadata. Given a non-image named `.jpg`, then `rejected`. Given an unpublished asset, when fetched without a signature, then refused. |
| C4 | Given `<script>` and event-handler text in every field, when rendered, then inert. Given a pasted unsupported video host, then `422`. Given a journal with an asset still processing, when submitted, then blocked. Given a material edit to a published journal, then back to `pending`. |
| C5 | Given 50 parallel likes, then the count is 50. Given a deleted account, then its public content, profile and follows disappear. Given a staff report threshold on a comment, then held until staff decide. |
| C6 | Given no preferences, then pages match `main`. Given preferences, then `scoreMatch` is deterministic and `reasons` equal the score terms. Given a Vietnamese query without diacritics, then it finds the accented title. |
| C7 | Per ADR, written when the phase opens. |

## Flows and failure states

Each route's failure rows in [API](specs-community-api.md) become test cases one for one.
Gate-closed, banned-user, stale-`If-Match`, rate-limited, quota-exceeded and
storage-unavailable are mandatory cases in their phases.

## Dependencies and security

Tests depend on the fixtures for media and on a test double for `MediaStore`. Security
tests are listed in [security](specs-community-security.md). Recommend `/qc-check` and
`/sec-check` at the end of C2, C4 and C5; neither runs unless asked.

## Test scenarios

The matrix above, plus: concurrent submit and decide on one item; revision race in the
queue; copy quota across midnight; moderator removal while a reader has the page open;
`ModerationEvent` is appended for every transition and never edited.

## Open questions

| # | Question | Recommended |
|---|---|---|
| 1 | Can the PostgreSQL adapter be tested in CI, or only locally? | Check `.github/workflows/ci.yml`; use the JSON adapter in CI if no database is provided |
| 2 | Is a load test of the write path wanted before C5? | A small one, to settle decision DB5 with data |
