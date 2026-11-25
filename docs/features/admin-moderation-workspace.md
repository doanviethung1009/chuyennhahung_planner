# Feature — Admin moderation workspace

🇻🇳 Bản tiếng Việt: [admin-moderation-workspace.vi.md](admin-moderation-workspace.vi.md)

## Summary

`/admin/community` reads as one triage workspace instead of four stacked lists. A jump-link bar at the top shows a live count per section; the sections follow a fixed order (trips awaiting review → held reviews → reports → switched-off authors; a "reviews awaiting approval" section is added only while legacy pending reviews exist); every list has an empty state; every item card has the same layout; trips and reviews get a read-only history (P07-14). Presentation only: no moderation rule, state machine, API, route or request changes.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/community` | unchanged | unchanged |

No new route and no new API. The history reads the existing `GET /api/admin/community/events?targetId=` (action `community:moderate`).

## Data

Nothing is stored. Each list still makes the same single GET it made before; the counts are the lengths of those lists, reported to the jump-link bar through a small React context (`workspace.tsx`).

## How it works

- **Order and counts** are pure functions in `src/components/admin/community/workspace-model.ts`: `SECTION_ORDER`, `visibleSections(canRestrict)`, `splitTrips`, `splitReviews`, `reportCount`.
- **Counts** are the to-do counts: pending trips, held reviews (and pending reviews while any legacy ones exist: reviews are published on submission, ADR 0014 amended 2026-11-15, so the section and its jump link are hidden when there are none), **open** reports (the count disappears when the reports filter shows another status), and every row of the restrictions list. Trips and reviews already decided stay on the page below the pending list (`Already decided`, `Other reviews`); they are not in the count.
- **Layout** is shared through `queue-parts.tsx`: `QueueSection` (anchor, heading, count), `EmptyState`, `StatusBadge`, `ItemActions`. Item titles are `h3` under each section `h2`; the page has one `h1`.
- **Keyboard order** is DOM order = reading order: jump links, then each section top to bottom; inside a card, content, action buttons, then History.
- **`canRestrict`** still gates the restrictions section and the nav link (and the existing per-review mute button) exactly as before.
- **History** (`HistoryLink`) loads the events for a trip or review id on first open: action, status change, actor, date, staff reason as plain text. Reports and restrictions have no history link: events are not recorded against a report id, and a restriction on an account is logged against the user id, which the list does not expose.

## Files

| Path | Role |
|---|---|
| `src/app/(admin)/[locale]/admin/community/page.tsx` | page: header, nav, fixed section order |
| `src/components/admin/community/workspace-model.ts` | pure order, grouping and count helpers |
| `src/components/admin/community/workspace.tsx` | counts context and jump-link bar |
| `src/components/admin/community/queue-parts.tsx` | shared section, empty state, badge, action row, history |
| `listing-queue.tsx`, `review-queue.tsx`, `report-queue.tsx`, `restriction-list.tsx` | the lists (layout only) |
| `messages/*.json` | `adminCommunity.workspace.*`, two renamed headings |

## Tests

`tests/admin-moderation-workspace.test.ts` covers the helpers (order, visibility including the legacy-pending rule, grouping, counts add up to list length, report count rule). The existing `community-*` and `review-restrictions-routes` suites are unchanged. Not tested: the rendered components (no component test setup yet) and a browser pass.

## Limits and open questions

Lists keep the API's 200-row cap for reviews, so counts are of what is listed. Counts load after the lists, so the bar fills in a moment after the page. No `/sec-check` needed (no new data exposed); `/qc-check` is worth running.
