# Feature — Moderation events

🇻🇳 Bản tiếng Việt: [moderation-events.vi.md](moderation-events.vi.md)

## Summary

Every community action that already exists (listing requests and decisions, review decisions, restrictions) now leaves one append-only record, written in the same Planner-store transaction as the change. Staff can read the history of one trip, review or user; nobody can edit or delete it. This is groundwork (ADR [0019](../adr/0019-community-foundation.md) §1–§2): nothing visible changes for visitors or authors.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `GET /api/admin/community/events?targetId=` | same | same |

Staff only (`community:moderate`: editor, admin, service token), `Cache-Control: no-store`. `400` without `targetId`, `401` anonymous, `403` member. Response `{ items, count }`, newest first, at most 200. No write verb exists.

## Data

`AuditEvent` — `id`, `targetKind` (`trip` | `review` | `user`), `targetId`, `actorId` (≤80), `actorKind` (`user` | `service`), `action`, `fromStatus`, `toStatus`, `reason` (≤500, nullable), `createdAt`. Table `audit_events` (migration `0010_audit_events.sql`, manual rollback `db/rollback/0010_audit_events.sql`), JSON key `auditEvents`; no foreign keys (ADR 0013); index `(target_id, created_at)`.

| Target | Action → from → to | Actor |
|---|---|---|
| trip | `request` any → `pending`; `withdraw` any → `draft`; `approve` `pending` → `published`; `reject` `pending` → `rejected`; `remove` `published` → `removed`; `requeue` `published` → `pending` (an edit) | owner / staff / `service` |
| trip | `withdraw` → `draft`, reason `implicit_end` (left `public`, archived, share revoked) | `system` (`service`) |
| review | `approve`, `reject`, `hold`, `remove` (`pending`/`approved`/`held` → new status); `republish` `held` → `approved` (author edit) | staff / author |
| review | `erase` (ADR 0024 §8) any status → `removed`; reason is staff text only, never the erased content or a key | admin / `service` |
| review | `guest_limit` (no status change; actor `system`; at most one per hour) when a guest hits the hourly review limit | route |
| user | `restrict` → `active`; `lift` `active` → `lifted` (also when the account is deleted, actor `account deleted`) | staff / `service` |

State names are those of the moderation state machine `src/server/community/submission.ts` (ADR 0019 §1): `draft`, `pending`, `approved`, `published`, `rejected`, `removed` are stored today; `changes_requested`, `unpublished`, `archived` exist in the module but are not stored yet. A staff `remove` is `removed` in the module and `rejected` in the stored listing.

Personal data: actor ids and reasons that may quote user text. Never an email, a review body or a guest key; a guest restriction's `targetId` is the restriction id.

## How it works

`appendEvent(data, event, { id, at })` in `src/server/community/events.ts` pushes one row into `data.auditEvents` inside the `transaction` callback of each repository method, so the event and the change commit or roll back together. A failing action (wrong state, forbidden, validation) throws before commit and writes nothing; an idempotent no-op (withdraw with no listing, lifting a lifted restriction, revoking an already private trip) writes nothing. Creating a live review is not a moderation action and is not logged. The repository exposes only `listEvents(targetId)`; the module has no update or delete. Retention: each append drops events older than 365 days (`AUDIT_RETENTION_DAYS`).

## Files

| Path | Role |
|---|---|
| `src/server/community/events.ts` | `appendEvent`, `eventsForTarget`, retention |
| `src/server/planner/schemas.ts` | `auditEventSchema` |
| `src/server/planner/repository.ts` | one `record(...)` call per action; `listEvents` |
| `src/server/planner/store.ts`, `persistence/planner-rows.ts`, `persistence/planner-transfer.ts` | collection, table mapping, strict import/export schema |
| `src/app/api/admin/community/events/route.ts` | staff read route |
| `db/migrations/0010_audit_events.sql`, `db/rollback/0010_audit_events.sql` | table and rollback |

## Tests

`tests/moderation-events-cases.ts` (shared) runs on the memory store in `tests/moderation-events.test.ts` and on PostgreSQL in `tests/planner-postgres.integration.test.ts`: one event per action with correct from/to/actor, failures and no-ops write none, a forced throw after the callback leaves no event and no change, guest key absent, no update/delete method. Also retention, reason/actor caps, export/import round-trip and a file without `auditEvents`; `tests/moderation-events-route.test.ts` (401/403/200/400, `no-store`, no write verbs); Postgres cases for reviews and restrictions (P10-14). The PostgreSQL cases skip without `TEST_DATABASE_URL`; CI runs them.

## Limits and open questions

- The review queue surfaces `guest_limit` as a badge with time (`guestLimitAt`, folded into the queue on the server); other events are still read through the events route only.
- Role, template and user-admin changes are not logged yet; report and terms events arrive with their own batches.
- The author-facing projection (own trip, no actor identity) is deliberately not built: no UI consumes it.
- Rollback: remove the `record` calls and the route, run the rollback SQL by hand. A JSON export that contains `auditEvents` is rejected by older code (`.strict()` schema): export with this version's schema first, or delete the key.
- A sec-check on the privacy of the log is recommended and has not been run.
