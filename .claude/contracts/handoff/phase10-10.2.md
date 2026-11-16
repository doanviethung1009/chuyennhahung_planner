# Handoff — batch 10.2 Audit Events
Branch `feat/moderation-events` (nothing committed/pushed). Contract: `phase10-10-2-audit-events.md`.

## Done
- Step 0 (P10-14): Postgres cases for reviews/restrictions in `tests/planner-postgres.integration.test.ts` (green before refactor).
- `AuditEvent` (`schemas.ts`), table `audit_events`, key `auditEvents` in `planner-rows`, `planner-transfer` (counts), `store`; **migration `0010_audit_events.sql`** + `db/rollback/0010_audit_events.sql`. Counters table for 10.3 therefore = `0011`.
- `src/server/community/events.ts`: `appendEvent(data: Pick<PlannerData,'auditEvents'>, event: NewAuditEvent, env: { id: string; at: string }): AuditEvent`; `NewAuditEvent` = `{ targetKind, targetId, actorId, action, fromStatus, toStatus, reason?, actorKind? }` (actorKind defaults: `service` / `account deleted` / `system` → service). Also `eventsForTarget`, `AUDIT_RETENTION_DAYS` (365; sweep runs inside each append).
- Repository: private `record(data, event)` supplies id (`evt_…`) + clock; `listEvents(targetId)`. Call it inside `transaction` callbacks (10.4/10.5: add `targetKind` values by widening the zod enum + DB CHECK in your own migration).
- Route `GET /api/admin/community/events?targetId=` (`community:moderate`, no-store).
- Docs: `docs/features/moderation-events.{md,vi.md}`, README rows, architecture, specs-community-database numbering, project-context; ADR 0019 → Accepted (+ index).

## Choices to know
- Implicit end logs `withdraw`, actor `system`, reason `implicit_end`; `approve` = one event pending→published; creating a live review and plain review edits log nothing; request is always logged (it resets `requestedAt`).
- Older code rejects a JSON export containing `auditEvents` (`.strict()`): noted in the feature doc.

## Checks (real output in the final report)
typecheck PASS · lint PASS · test PASS: with TEST_DATABASE_URL 67 files, 950 tests; without it 65 files + 2 skipped (Postgres), 908 passed, 42 skipped. Postgres cases ran against a local PostgreSQL 14 (`TEST_DATABASE_URL`); CI also runs them.
qc / security: NOT RUN (recommend `/sec-check` on log privacy).
