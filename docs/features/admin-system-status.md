# Feature — Admin system status

🇻🇳 Bản tiếng Việt: [admin-system-status.vi.md](admin-system-status.vi.md)

## Summary

A super admin answers the operator's first questions on one page: which store each domain runs on, whether its database answers, the last migration applied, which build is running, which integrations are configured, and whether the health probe passes. It is read-only: no button, no log, no secret or host (P07-17).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/system` | `/quan-tri/he-thong` | `/en/admin/system` |
| `GET /api/admin/system` | same | same |

Both need `runbook:read` (super admin only). Admin and editor get `403` from the API and the usual admin `404` from the page; the service token gets `403` (it does not hold the action); anonymous gets `401`. `Cache-Control: no-store`.

## Data

Nothing is stored. The response is the allow-listed `SystemStatus` in `src/server/admin/system.ts`: `planner` and `content` (`store` `postgres|file`, `database` `ok|unreachable|not_applicable`, `lastMigration` file name or null), `build` (`version`, `buildId`), `integrations` (`googleSignIn`, `adminApiToken`, `siteUrl` as booleans; `publicContentSource` `repository|static`), `health` (`ok|failed`), `backups` (always `not_configured`).

## How it works

Store mode comes from the **presence** of `PLANNER_DATABASE_URL` / `CONTENT_DATABASE_URL`; the URL is passed only to a one-connection `pg` pool that runs `SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1` and closes. Each probe is bounded (query timeout 3 s plus an overall 4 s race), so a database that accepts the connection but never answers also reads `unreachable`. Any failure becomes `unreachable`; the driver message is never read. The migration name must match the migration file pattern. The health probe calls the same handler as `/api/health` in process. `buildId` is Next's `.next/BUILD_ID` (null if absent). The backups line is a constant: no backup facts exist yet (owner decision D10).

## Files

| Path | Role |
|---|---|
| `src/server/admin/system.ts` | allow-listed status and probes |
| `src/app/api/admin/system/route.ts` | read API |
| `src/app/(admin)/[locale]/admin/system/page.tsx`, `src/components/admin/system/system-status.tsx` | page |
| `src/lib/admin-gate.ts`, `src/i18n/routing.ts`, `messages/*.json` | sidebar link (Operations), route, strings (`adminSystem`) |

## Tests

`tests/admin-system.test.ts`: 401/403/200 per role and the service token, `no-store`, fixed field set, a sentinel test (database URLs, Google keys, site URL, admin token, store path set in env and absent from the response), DB-down path (`unreachable`, no 500, no driver text), sidebar visibility and the page gate. `runbook.test.ts` keeps the API table in sync. Not tested: the page in a browser beyond the manual pass noted in the PR.

## Limits and open questions

When the **Planner** database is down a super admin cannot sign in (the session lives there). The Planner repository also builds the Content repository (`src/server/planner/instance.ts`), so a Content database that is unreachable when the process starts blocks sign-in too. The page therefore shows `unreachable` only for a database that fails *after* the instances are built (or a probe that stalls); a database already down at startup is seen as a failed sign-in, not on this page. Backups stay "not configured" until the owner supplies facts. A `/sec-check` is recommended before merge (information-leak risk).
