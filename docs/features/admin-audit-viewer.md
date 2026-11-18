# Feature — Admin audit viewer

🇻🇳 Bản tiếng Việt: [admin-audit-viewer.vi.md](admin-audit-viewer.vi.md)

## Summary

Admins can answer "who did what, and when" from one page. `/admin/audit` lists the append-only audit log (batch 10.2) with filters and paging, and the account and content acts that used to leave no trace now write an event: role change, create user, reset password, ban and unban, soft delete, restore, permanent delete, Google unlink, token rotation, story publish, unpublish and archive. It is read-only: there is no way to edit, delete or export an event (P07-13, closes the ADR 0010 limit "any admin can reset another admin's password unrecorded").

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/audit` | `/quan-tri/nhat-ky` | `/en/admin/audit` |
| `GET /api/admin/audit` | same | same |

Both need the new action `audit:read` (admin, super admin, service token; **not** editor). An editor gets `403` from the API and the usual admin `404` from the page. Query: `actor`, `targetType` (`trip` | `review` | `user` | `story`), `action`, `from`, `to` (date or date-time; a bare date is the whole UTC day), `limit` (1–100, default 50), `cursor`. Invalid input is a `422`. Response `{ items, count, nextCursor }`, newest first, `Cache-Control: no-store`.

## Data

Same `AuditEvent` as [moderation-events](moderation-events.md), plus target kind `story` (migration `0015_audit_admin_events.sql`: widens the `target_kind` check and adds indexes `(created_at DESC, id DESC)` and `(actor_id, created_at DESC)`; manual rollback `db/rollback/0015_audit_admin_events.sql`). Admin events use `targetKind: user` (`targetId` = the account id) or `story` (the slug).

| Act | Action | From → to |
|---|---|---|
| create user | `user_create` | → role |
| change role | `role_change` | old role → new role |
| reset password | `password_reset` | – |
| ban / unban | `ban` / `unban` | `active` ↔ `banned` |
| soft delete / restore | `soft_delete` / `restore` | `active` ↔ `deleted` |
| permanent delete | `purge` | `deleted` (or `active` by the service token) → – |
| Google unlink | `google_unlink` (only when a link existed) | – |
| token rotation | `token_rotate` | – |
| story status | `publish` / `unpublish` / `archive` | status → status |

The actor is the account id, or `service` for the admin token. No email, password, token or guest key is stored or returned; the API adds the actor's handle for display. `reason` is plain text, escaped on render.

## How it works

User acts append through `PlannerRepository.record` **inside the same transaction** as the change, so a failed write leaves neither; a no-op or refused act writes nothing. A story's status lives in the Travel Content store, a different store, so its event is a second write (`recordAdminEvent`) right after the content write succeeds: it cannot share a transaction, and a failure between the two would lose the event (see limits). The page is a server component with a plain GET form (works without JavaScript, URL is shareable) and calls the same `listAuditEvents` as the API. Order is `(createdAt, id)` descending, so the cursor is total and pages never overlap. Action names without a label (the older community ones) are shown as stored.

## Files

| Path | Role |
|---|---|
| `src/server/identity/permissions.ts` | action `audit:read` |
| `src/server/planner/repository.ts` | event appends, `listAuditEvents`, `recordAdminEvent`, cursor helpers |
| `src/server/planner/schemas.ts` | `story` target kind |
| `src/app/api/admin/audit/route.ts` | read API |
| `src/app/api/admin/travel/stories/[slug]/status/route.ts` | story event |
| `src/app/(admin)/[locale]/admin/audit/page.tsx`, `src/components/admin/audit/audit-table.tsx` | page, filter form, table |
| `src/lib/admin-gate.ts`, `src/i18n/routing.ts`, `messages/*.json` | gate, sidebar link, route, strings (`adminAudit`) |
| `db/migrations/0015_audit_admin_events.sql` | kind check and indexes |

## Tests

`tests/admin-audit-cases.ts` (run on memory; on PostgreSQL through `planner-postgres.integration.test.ts` when a test database is set): one event per act, none for a no-op or failure, rollback with the change, no email/password/token in events, filters and cursor. `tests/admin-audit.test.ts`: 401/403/200 per role, `no-store`, `422` validation, deterministic paging, no secrets in the response, story events, no raw-HTML sink in the page. `planner-roles.test.ts` (matrix), `admin-portal.test.ts` (sidebar), `admin-layout.test.ts` (editor 404), `runbook.test.ts`, `i18n.test.ts`. Not tested: the rendered page in a browser beyond the manual 375/768/1280 pass noted in the PR.

## Limits and open questions

Story events are not transactional with the content write. Places have no publish state yet, so no place events; collection and review status changes are not logged (outside the contract). The Google unlink and token rotation routes are token-only, so their actor is `service`. The JSON store filters in memory, fine at the one-year retention volume. Retention stays 1 year (10.2). Report and terms events wait for 10.4/10.5. A `/sec-check` is recommended before merge (new personal-data read).
