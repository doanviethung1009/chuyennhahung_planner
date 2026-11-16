# Admin Workspace spec — database, API, RBAC and gates

🇻🇳 Bản tiếng Việt: [specs-admin-workspace-impact.vi.md](specs-admin-workspace-impact.vi.md)

Status: **Proposed** (2026-11-17). Companion to [specs-admin-workspace.md](specs-admin-workspace.md);
feature IDs `P07-10`…`P07-18` are defined there and in `.claude/contracts/admin-workspace-index.md`.
Any database, authorization, public-API or important-route change below needs the owner's
architecture approval before its session starts.

## Database impact

| Feature | Change | Migration |
|---|---|---|
| `P07-10` Shell, `P07-11` Dashboard, `P07-12` Users, `P07-14` Moderation, `P07-15` Collections/Integrity, `P07-17` System | none; read existing stores | none |
| `P07-13` Audit viewer | reads `audit_events` from batch 10.2; may add an index for the actor/date filters, and new event kinds reuse the same table | at most one additive index migration, numbered by merge order after Phase 10's `0010`–`0013`; decided in that session once 10.2 has merged |
| `P07-16` Create/archive | none; same content tables (ADR 0013) | none |
| `P07-18` Media | none now; Phase 08 owns `media_assets` | none |

No foreign keys between content entities (CLAUDE.md rule 6). Both JSON and PostgreSQL adapters
must keep passing; nothing here writes a new document type to the JSON store except new event
kinds in `auditEvents`.

## API impact

| Endpoint | Change | Auth | Feature |
|---|---|---|---|
| `GET /api/admin/overview` | new, read-only, `no-store`, counts filtered by the caller's actions | session or service, any staff action | `P07-11` |
| `GET /api/admin/planner/users` | additive `limit`, `cursor`, `sort`; default unchanged for old callers | `user:provision` | `P07-12` |
| `GET /api/admin/audit?actor=&targetType=&action=&from=&to=&cursor=` | new, paginated, `no-store` | `audit:read` | `P07-13` |
| `POST /api/admin/travel/stories`, `…/places` | switch to `adminContentRoute` (session-capable) and add archive; unchanged body schema | `content:write` | `P07-16` |
| `GET /api/admin/system` | new, booleans and identifiers only | `runbook:read` | `P07-17` |
| Collections, integrity, Google unlink, rotate-token | no change; first screens | as today | `P07-15`, `P07-12` |

All new handlers: strict zod on query/body, `requireSameOrigin` on mutations (ADR 0010), the
shared error envelope, never an error message that reveals whether a record exists to a role that
may not see it. Deprecated: nothing. `docs/runbook.md` lists every route handler and
`tests/runbook.test.ts` keeps it in sync, so each new route is added there.

## RBAC impact

| Change | Detail |
|---|---|
| New action `audit:read` | `admin`, `super_admin`, `service`. Not `editor`: events quote moderator reasons that may cite user text |
| No other new action | System reuses `runbook:read` (super admin only); dashboard needs no action, it shows only cards the caller's actions allow |
| `ROLE_ACTIONS` test | `tests/planner-roles.test.ts` matrix updated in the same PR; the role-matrix page renders `ROLE_ACTIONS` and a test fails if it renders anything else |
| Unchanged | `canManageRole`, last-admin guards, `trip:support-read` stays denied to everyone |

## Security checklist

Applies to every feature session; `/sec-check` is **NOT RUN** until the owner calls it, and is
recommended after `P07-13` (new read of personal data), `P07-16` (new write routes) and `P07-17`.

- [ ] Server decides access (`requireStaff`, then the API); sidebar visibility is cosmetic.
- [ ] 404 for a role with no rights to a page, as today; no 403-vs-404 oracle added.
- [ ] No `ADMIN_API_TOKEN`, `process.env` or `src/server` import under `src/components/admin` (`tests/admin-portal.test.ts`, `tests/client-boundary.test.ts`).
- [ ] No secret value in any response or on screen; `/admin/system` returns presence booleans.
- [ ] Mutations same-origin; one-time secrets stay in React state and `no-store` responses.
- [ ] Audit viewer: reason text escaped on render, no email, no guest key, no password material.
- [ ] Pagination caps enforced server-side; filters validated, no raw SQL, no unbounded scan.
- [ ] Admin pages `noindex`; nothing added to sitemap or `robots` allow lists.
- [ ] Rate limit: reuse existing limiters; no new limiter module.

## QC checklist

`/qc-check` is **NOT RUN** until the owner calls it. Each session reports checks as PASS with
output, or NOT RUN.

- [ ] Focused tests first, then `npm run typecheck`, `npm run lint`, `npm run test` at the integration gate; `npm run build` before the PR.
- [ ] Every user-visible string in `messages/vi.json` and `messages/en.json` (`tests/i18n.test.ts`).
- [ ] One `<h1>` per page, ordered headings, landmarks (`nav`, `main`), visible focus, ≥44px targets, `alt` where images exist, no `href="#"`.
- [ ] 375 / 768 / 1280px: no horizontal scroll, sidebar usable by keyboard.
- [ ] Role matrix per route: anonymous → sign-in with `returnTo`; member → 404; editor, admin, super admin → only their screens.
- [ ] Existing URLs still resolve; `returnTo` allow-list covers new paths and still rejects near misses (`tests/return-to.test.ts`).
- [ ] Both stores where a feature reads data (Postgres cases skip locally without `TEST_DATABASE_URL`; the PR says which ran).
- [ ] Feature document in both languages, row in `docs/features/README.*`, `docs/architecture.*` and `.claude/context/project-context.md` corrected.

## Session gates

| Gate | Who | Evidence |
|---|---|---|
| Architecture approval | owner | ADR 0020 Accepted; per-feature contract `READY`; required for database, `audit:read`, route and public-API items |
| Implementation | one feature session, one contract | short handoff note under `.claude/contracts/handoff/` |
| QC and security | owner calls `/qc-check`, `/sec-check` | verdicts quoted in the PR |
| Architect review | architect session | diff matches contract file scope |
| Merge | owner | no session merges its own PR |
