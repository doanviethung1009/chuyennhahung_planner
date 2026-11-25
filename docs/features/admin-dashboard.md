# Feature — Admin dashboard

🇻🇳 Bản tiếng Việt: [admin-dashboard.vi.md](admin-dashboard.vi.md)

## Summary

`/admin` shows what is waiting, per role: pending trip listings and reviews, open reports, active restrictions, story and review drafts, published content, data integrity issues, active and banned/soft-deleted accounts, and (super admin) where the two stores live. Each card links to its screen. Counts only, read-only, no polling.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |
| `GET /api/admin/overview` | same | same |

The API takes the admin token or a staff session (`content:write` or higher), answers `no-store`, and returns `{ cards: [{ id, href, state, count?, atLeast?, severity?, detail? }] }`. `id` is a fixed enum; `state` is `ok` or `unavailable`; `atLeast: true` marks a count that is a lower bound; `detail` (runtime card only) is `postgres`, `file` or `mixed`. Never an exception message or a connection string; no handle, email or secret is ever in the payload.

## Data

No new table, write or repository method. Counts come from existing methods: `listListingQueue`, `listReviewQueue('pending')`, `listReports('open')`, `listRestrictions(true)`, `listStories`/`listReviews` (drafts and published; places have no draft status), `validateIntegrity`, `listUsers`.

| Card | Needs action | Opens |
|---|---|---|
| `listingsPending`, `reviewsPending` | `community:moderate` | `/admin/community` |
| `reportsOpen` | `community:moderate` | `/admin/community` |
| `restrictionsActive` | `community:restrict` | `/admin/community` |
| `contentDrafts`, `contentPublished` | `content:write` | `/admin/content/stories` |
| `integrityIssues` | `content:write` | `/admin/content/integrity` |
| `usersActive`, `usersDisabled` | `user:provision` | `/admin/users` |
| `runtime` | `runbook:read` | `/admin/runbook` |

## How it works

`buildOverview(principal, sources)` in `src/server/admin/overview.ts` keeps the cards the role may see (the same `can()` as the screen each opens) and reads each source independently: a failing source turns only its card into `state: 'unavailable'`, never a 500. The page calls `loadOverview` directly; the route does the same behind `adminContentRoute`. Works on JSON and PostgreSQL stores because it only uses repository methods. `OverviewCards` is a server component. The payload depends on the role alone, so `loadOverview` keeps one entry per role for 15 seconds (in-process, shared by the page and the route): the full-list reads run at most once per role per window, and counts can be up to 15 seconds old after a change made elsewhere. Any state-changing admin request (POST/PUT/PATCH/DELETE through the admin route guards, `src/server/overview-cache.ts`) drops the cache when it finishes, so a moderation, ban or status change shows on the next dashboard load without waiting. Member and reader writes (any `plannerRoute` write, `POST /api/community/reports`, `POST /api/community/reviews`) drop the dashboard payloads too (`invalidateOverviewPayloadsAfter`), but not the public catalogue cache, so a new listing request or report shows at once. The Google sign-up callback (a GET that creates an account) does not, so a new account can take up to 15 seconds to show. A role with no cards sees an empty state. `listReviewQueue` returns at most 200 rows, so a pending-review count of 200 is shown as "200+" (`atLeast`), never as an exact total.

## Files

| Path | Role |
|---|---|
| `src/server/admin/overview.ts` | Card definitions, count-source table, `buildOverview`, real sources |
| `src/app/api/admin/overview/route.ts` | `GET /api/admin/overview` |
| `src/components/admin/dashboard/overview-cards.tsx` | Cards, unavailable and empty states |
| `src/app/[locale]/admin/page.tsx` | Dashboard page |

## Tests

`tests/admin-overview.test.ts`: role matrix, member-write invalidation (a listing request shows within the same window), the 200+ lower bound, closed `state`/`detail` sets, (anonymous 401, member 403, editor, admin, service), counts against a fixture, payload privacy, degraded-card and empty paths. `tests/runbook.test.ts` (route list sync), `tests/i18n.test.ts`, `tests/docs.test.ts`.

## Limits and open questions

No activity card: the events route (`/api/admin/community/events`) needs a `targetId`, so there is no recent-activity feed to summarise; it waits for the audit viewer (P07-13). `reportsOpen` and `integrityIssues` flag "needs action" above zero; the integrity count runs a full sweep, so it relies on the 15-second cache. The integrity routes themselves stay token-only; the dashboard reads the repository directly and shows a count only. Visual pass at 375/768/1280px: see the PR.
