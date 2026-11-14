# Feature — Shared budget overrun

🇻🇳 Bản tiếng Việt: [shared-budget-overrun.vi.md](shared-budget-overrun.vi.md)

## Summary

When a trip is shared with a group, the budget section used to show only the target and
the plan estimate, so the team could not see that spending had gone past the budget or
how much each person would have to add. The shared page and the owner's trip page now
show the projected total, the overrun, and each person's extra share. Builds on
[travel-planner-core.md](travel-planner-core.md) and [trip-editor.md](trip-editor.md).

## Routes

None. Changes `/shared/[token]` and `/my-trips/[id]` in place.

## Data

`TripBudgetSummary` gains `overrunVnd` and `perPerson.overrunVnd`. `SharedTripView.budget`
gains `projectedTotalVnd`, `overrunVnd` and `overrunPerPersonVnd`. Message keys
`budgetProjected`, `overrunHeading`, `overrunTotal`, `overrunPerPerson`, `withinBudget`,
`overrunNote` in the `shared` and `tripDetail` namespaces (VI and EN).

## How it works

`overrunVnd = max(0, projected − target)`, and 0 when the target is 0 (no budget set, so
nothing to overrun). `projected` is what has been paid plus the estimate of activities not
yet paid for, so nothing is counted twice. The per-person share is the overrun divided by
the party size, **rounded up** so the group covers the whole amount. The share view is an
allow-list projection: only these three totals are added; individual expenses, their
labels and `actualTotalVnd` stay private. With a target and no overrun the shared page
says it is within budget.

## Files

| Path | Role |
|---|---|
| `src/server/planner/budget.ts` | Computes `overrunVnd` and the per-person share |
| `src/server/planner/schemas.ts` | `SharedTripView.budget` type |
| `src/server/planner/repository.ts` | `buildSharedView` allow-list |
| `src/app/[locale]/shared/[token]/page.tsx` | Overrun block on the public page |
| `src/components/planner/trip-detail.tsx` | Projected, overrun and per-person rows for the owner |
| `messages/vi.json`, `messages/en.json` | New strings |

## Tests

`tests/planner-budget.test.ts` asserts the overrun and per-person share, and 0 when the
plan fits. `tests/planner-sharing.test.ts` asserts the shared totals, that no expense label
or `actualTotalVnd` leaks, and the exact key set of the budget projection.

## Limits and open questions

The projected total reveals roughly how much was spent to anyone with the link; the owner
should decide whether that is acceptable for public trips. The even split ignores who
actually paid and any per-person shares; real cost splitting between members is not built.
The UI was not checked in a browser.
