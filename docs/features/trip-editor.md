# Feature — Trip editor

🇻🇳 Bản tiếng Việt: [trip-editor.vi.md](trip-editor.vi.md)

## Summary

A traveller can fill in a trip after creating it — blank or cloned from a story — on
`/my-trips/[id]`: change the trip's details, add and remove days, write each day's
title and note, add, edit, delete, reorder and move activities, and record what was
actually spent. Before this, that page could only change status, duplicate, archive and
share. Builds on [travel-planner-core.md](travel-planner-core.md) and
[create-blank-trip.md](create-blank-trip.md).

## Routes

None. The editor lives on the existing `/my-trips/[id]` (`/chuyen-di-cua-toi/[id]`,
`/en/my-trips/[id]`). Archived trips stay read-only there.

## Data

- No API or schema change. Reads and writes go through the existing owner-scoped Planner API: `PATCH /api/planner/[id]`, `PATCH …/days/[dayNumber]`, `POST …/activities`, `PATCH` and `DELETE …/activities/[activityId]`, `PATCH …/reorder`, `POST …/expenses`, `PATCH` and `DELETE …/expenses/[expenseId]`.
- Reads the public catalog `GET /api/travel/places?destinationSlug=…` to offer places. The seed catalog currently holds places for Đà Lạt only; for any other destination the place picker is simply absent and every activity is self-made.
- Messages: new namespace `tripEditor` (including `tripEditor.category.*`) and the key `tripDetail.budgetActual`, in both `messages/vi.json` and `messages/en.json`.

## How it works

1. `TripDetail` renders `TripEditor` for an active trip and keeps its old read-only list for an archived one.
2. Every write goes through one `mutate` helper: it sends the version the page last read as `If-Match`, and replaces the page's whole state with the `TripView` the API answers with — so the budget summary and the next `If-Match` are always current, with no refetch.
3. Days are resized through the trip's `durationDays` (the API has no add-day route). Adding appends empty days; shrinking is refused with `409 invalid_state` while a removed day still holds an activity or an expense, and the page says so and changes nothing.
4. An activity picked from the catalog prefills its name, duration and cost, all still editable; the place itself cannot change afterwards (the update schema has no `placeSlug`). Move up/down and "move to day" use `PATCH /reorder`; there is no drag-and-drop.
5. Every delete asks first, inline ("Delete this activity?" with Delete / Keep it).
6. Errors: `401` goes to sign-in; `412` says the trip was changed elsewhere and reloads it; `409` and `422` show a plain message; anything else shows a generic one. The message sits in a `role="status"` region.
7. Costs show exact dong (`300.000 ₫`), not the rounded millions used in the summary, and say whether they are per person or for the group.

## Files

| Path | Role |
|---|---|
| `src/components/planner/trip-editor/trip-editor.tsx` | Orchestrator: `mutate`, status message, catalog fetch |
| `src/components/planner/trip-editor/trip-fields-form.tsx` | Trip details form (also resizes days) |
| `src/components/planner/trip-editor/day-card.tsx` | One day: title/note, activity list, reorder, move, delete |
| `src/components/planner/trip-editor/activity-form.tsx` | Add / edit one activity |
| `src/components/planner/trip-editor/expenses-panel.tsx` | Expense list and form |
| `src/components/planner/trip-editor/shared.ts` | `Mutate` type, category lists, `formatDong`, `wholeNumber` |
| `src/components/planner/trip-detail.tsx` | Mounts the editor; summary gains "actually spent" |
| `messages/vi.json`, `messages/en.json` | Strings |
| `.claude/contracts/trip-editor.md` | Task Contract |

## Tests

No new test file: the repository has no component-test setup, and the API contract it drives is covered by the existing planner tests. `tests/i18n.test.ts` checks VI/EN parity of the new keys and `tests/docs.test.ts` the documents. The flows were exercised by hand in a browser against a local server with a scratch store: add, edit, reorder, move between days, delete with confirm, day title/note, trip details, growing and shrinking days (including the blocked shrink), expenses add/edit/delete, a stale-version `412`, and a catalog place on a Đà Lạt trip. 375px width showed no horizontal overflow. Keyboard-only use and screen readers were not tested.

## Limits and open questions

- Linking an expense to a specific activity is not offered; an existing link is kept when the expense is edited. Duplicate-day or whole-day reordering does not exist.
- The trip-details form keeps what was typed after a refused save or a conflict, so it can differ from the server's copy until the next successful save.
- No drag-and-drop, no undo; a delete is final once confirmed.
- The place catalog depends on the content seed; with more places the picker is a long `<select>`.
- `qc` and `security` have not been run on this change.
