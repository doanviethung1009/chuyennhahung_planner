# Feature — Community reports

🇻🇳 Bản tiếng Việt: [community-reports.vi.md](community-reports.vi.md)

## Summary

Any reader, with or without an account, can report a **public community trip** or a **live review** with a reason from a fixed list and an optional note. Staff see the reports in the admin community page, close each as *dismissed* or *actioned*, and every closing is logged. Accepting the Creator Terms is **not** needed to report. Batch 10.5 of ADR [0019](../adr/0019-community-foundation.md); owner decision D7 (trips and reviews are both reportable).

Not built: hiding content by report count, telling the reporter, appeals, comments or journals as targets, a moderator role, restricting a person from the report screen.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `POST /api/community/reports` | same | same |
| `GET /api/admin/community/reports?status=` | same | same |
| `POST /api/admin/community/reports/[id]/resolve` | same | same |

`POST /api/community/reports` — body `{ targetKind: 'trip' | 'review', shareToken | targetId, reason, note?, website? }`, strict (extra keys `422`). A trip is named by the public `shareToken`, a review by its public `id`. `reason` is one of `spam`, `harassment`, `personal_data`, `copyright`, `misleading`, `other`; `note` ≤ 500, plain text. Answer `201 { ok: true }`, `no-store`.
- A signed-in member is recognised only when the request is same-origin (`Sec-Fetch-Site` absent or `same-origin`), so another site cannot file a report in their name; otherwise the report is a guest report.
- Limit: 10 per day per member id, or per client key for a guest (`WRITE_LIMITS.report`, the shared async limiter, checked before the write): `429` with `Retry-After`. A failing limiter database is `503` and nothing is stored (fail closed).
- Honeypot: a filled `website` answers `201` and stores nothing.
- Unknown, not public, removed or restricted targets are one `404 not_found` (no existence leak). A repeat open report by the same reporter on the same target is dropped silently and still answers `201`.

`GET /api/admin/community/reports` — `community:moderate`, `no-store`; `?status=open|actioned|dismissed` (else all; `400` for another value). Items: `id`, `targetKind`, `targetId`, `targetLabel`, `targetLive`, `reason`, `note`, `status`, `signedIn`, `createdAt`, `handledAt`, `handledBy`, `handlerReason`. Never the reporter id, the client key or the share token.

`POST …/[id]/resolve` — `community:moderate`; body `{ outcome: 'dismissed' | 'actioned', reason }` (reason 3–500, strict). `actioned` only marks the report: removing the content stays the existing remove action. Idempotent for the same outcome (no second event), `409 invalid_state` for the other outcome, `404` for an unknown id. Writes one event on the **reported trip or review** (`report_dismissed` / `report_actioned`, `fromStatus` `open`).

## Data

`Report` — `id` (`rpt_…`), `reporterId` (member) or `null`, `clientKey` (guest: `sha256(client key)` cut to 32 hex, else `null`), `targetKind`, `targetId` (trip id or review id; the share token is resolved on the server and never stored), `reason`, `note`, `status`, `createdAt`, `handledAt`, `handledBy`, `handlerReason`. Table `reports` (migration `0013_reports.sql`, manual rollback `db/rollback/0013_reports.sql`), JSON key `reports`, index `(status, created_at)`, no foreign keys (ADR 0013). Personal data: a member id or a hashed key, and a free-text note (never logged). A permanent account delete removes that member's reports. Older code rejects a JSON export containing `reports` (`.strict()`).

`PublicCommunityReview` gained `id` (the review's random `rev_…` id, non-personal) so a reader can name the review. It is the only change to a public projection; `tests/community-reviews.test.ts` ("keeps the public projection") now lists `id` among the keys.

The shared limiter's counter retention went from 2 h to 48 h so a 24 h window fits (`COUNTER_RETENTION_MS`, `src/server/persistence/postgres-rate-limiter.ts`).

## How it works

`PlannerRepository.createReport` runs in one store transaction: it resolves the target (a trip must be active, public, with an approved listing; a review must be approved and not hidden by a restriction), drops an open duplicate, then pushes the row. `listReports` orders open first (oldest first), then closed (newest first), at most 200, and marks `targetLive: false` once the target is removed or no longer public, so the staff UI shows nothing left to act on. `resolveReport` writes the report update and its event in one transaction through `appendEvent`.

UI: `src/components/reports/report-button.tsx` — a real button (≥44px) opening a native modal `<dialog>` (the browser traps focus, Escape closes, focus returns), reason `<select>`, note `<textarea>`, an invisible honeypot, a status message. It sits on every community trip card (as a sibling of the card link, not inside it) and on each review. Admin: `src/components/admin/community/report-queue.tsx`, a section on `/admin/community` below the review queue, with a status filter and a decision note per open report. Strings: `communityReports` and `adminReports` in `messages/vi.json` and `messages/en.json`.

## Files

| Path | Role |
|---|---|
| `src/server/planner/{schemas,store,repository}.ts` | `reportSchema`, bodies, `createReport`, `listReports`, `resolveReport`, `PublicCommunityReview.id` |
| `src/server/persistence/{planner-rows,planner-transfer}.ts`, `postgres-rate-limiter.ts` | table mapping, strict import/export, retention |
| `src/server/{rate-limit.ts,planner/instance.ts}` | `report` limiter |
| `src/app/api/community/reports/route.ts`, `src/app/api/admin/community/reports/**` | routes |
| `src/components/reports/report-button.tsx`, `src/components/admin/community/report-queue.tsx`, card and review list, admin page | UI |
| `db/migrations/0013_reports.sql`, `db/rollback/0013_reports.sql` | table and rollback |

## Tests

`tests/community-reports-cases.ts` (shared) runs on the memory store in `tests/community-reports.test.ts` and on PostgreSQL in `tests/planner-postgres.integration.test.ts` (skipped without `TEST_DATABASE_URL`; CI runs it): guest and member, trip and review, no token / client key stored or returned, unknown and non-public targets, duplicates, resolve once with one event, removed review not live, account delete. `tests/community-reports-routes.test.ts`: `201`, no-store, cross-site treated as guest, `404` identical, `422`, honeypot, `429` + `Retry-After`, staff `401`/`403`/`200`, resolve idempotent with one event. `tests/community-reports-fail-closed.test.ts`: limiter down → `503`, nothing stored. Public projection test changed only for `id`; `tests/planner-rows.test.ts` lists the new table in the delete order.

## Limits and open questions

- The guest limit keys on `x-forwarded-for`, which a client can forge (hardening is batch 10.6); the per-reporter duplicate rule is bounded by the same key.
- No threshold, no reporter notice, no appeal. Reports of a removed item stay in the list as not actionable.
- Rollback: remove the control and the routes; run the rollback SQL by hand; stored rows are inert, and the review `id` is harmless to leave.
- `/sec-check` (anonymous write path, personal data in notes) is recommended and has not been run.
- UI at 375 / 768 / 1280 was not checked in a browser.
