# Task Contract: trip-editor — edit a trip after creating it
- Class: L
- Desired outcome / user impact: a traveller who creates a trip (blank or from a template) can fill it in on `/my-trips/[id]`: edit the trip header, add/remove days, edit day title and note, add/edit/delete/reorder/move activities, add/edit/delete expenses. Today the page is read-only apart from status, duplicate, archive and share.
- Scope IN: UI only, on the owner's detail page, for **active** trips. Trip fields (title, start date, days, party, budget target, style, pace, note); day title/note; activities (title, catalog place, start time, duration, cost, cost scope, category, note); move up/down within a day and to another day; expenses (label, category, amount, scope, day, linked activity, paid on, note); inline confirm before every delete.
- Scope OUT: any API/schema change (none needed, see Evidence); drag-and-drop; the shared read-only `ItineraryDays` (story + share page) stays untouched; editing `destinationSlug` (immutable by contract); the Planner map, AI suggestions; archived trips stay read-only; no component-test infrastructure is added.
- Evidence (existing files, APIs, models):
  - `src/app/api/planner/[id]/route.ts` PATCH (`tripUpdateSchema`, partial + strict, `If-Match` required). Changing `durationDays` adds or removes trailing days; removing days that still hold activities or expenses is refused with `invalid_state` (`repository.ts` `dropDays`). **There is no separate add-day/remove-day endpoint: days are resized through this PATCH.**
  - `days/[dayNumber]` PATCH (`title`, `note`). `activities` POST; `activities/[activityId]` PATCH and DELETE; `reorder` PATCH (`reorder-day` | `move-activity`); `expenses` POST; `expenses/[expenseId]` PATCH and DELETE.
  - Every mutation returns the full `TripView` (`tripResponse`) with `ETag: "<version>"`, so the client replaces its state from the response without a refetch.
  - `If-Match` is required on all of them (`requireVersion(..., true)`), except two spots that accept absence; the UI always sends `trip.version`. A stale version is 412 `version_conflict`.
  - Catalog places: public `GET /api/travel/places?destinationSlug=…&limit=100` → `{ places, count }`; `Place` has `slug`, `name`, `suggestedMinutes`, `estimatedCostVnd`, `category`.
  - Client helper `src/components/planner/api.ts` (`api(path, { method, body, version })`, `ApiError`, 401 → sign-in).
  - Limits: `DAY_LIMIT` 30, `ACTIVITIES_PER_DAY_LIMIT` 40, title/label 2–160, note ≤ 2000, `HH:MM` 24h, duration 5–1440 min, VND integers ≥ 0.
- Constraints / dependencies: branch `feat/trip-editor` is cut from `feat/blank-trip-create` (PR #51 open) — rebase onto `main` once it merges. CLAUDE.md rules 1 (VI+EN), 4 (no dead buttons), 5 (a11y: real buttons, ≥44px, visible focus, one `<h1>`, ordered headings), 7, 10–12.
- Architecture decision / ADR (if needed): none. The Planner UI phase is open (CLAUDE.md rule 6) and the API contract is unchanged (ADR 0002).
- Interface contract (API, types, DB): none new. Client types come from `TripView` (`@/server/planner/repository`) and the request shapes above. Request bodies must carry only schema fields (strict). Optional fields cleared by the user are sent as `null`; `placeSlug` cannot be changed on an existing activity (omitted from `tripActivityUpdateSchema`).
- Tasks by owner: Architect — this contract. BE — none (gap check: none found). FE — components below, messages, docs. QC/Security — NOT RUN (recommend `/qc-check`). Git — main session after the user approves.
- File ownership (avoid parallel overlap): one session, sequential. New: `src/components/planner/trip-editor/{trip-editor,trip-fields-form,day-card,activity-form,expenses-panel}.tsx and shared.ts`. Edited: `src/components/planner/trip-detail.tsx`, `messages/vi.json`, `messages/en.json`. New docs: `docs/features/trip-editor.md` + `.vi.md`, rows in both `docs/features/README*.md`; `docs/architecture.*` only if a statement there is now wrong.
- Acceptance criteria / tests:
  1. On an active trip the page shows an edit form for the header; saving sends only changed/valid fields with `version` and updates the page from the response.
  2. Day count can grow and shrink; shrinking over a non-empty day shows a clear message and changes nothing.
  3. Each day: edit title/note; add an activity (self-made or from a catalog place, place prefilling title/duration/cost); edit; delete with an inline confirm; move up/down; move to another day.
  4. Expenses: add, edit, delete with confirm; list shows a total and the budget summary (target, estimated, actual) refreshes after each change.
  5. 412 shows the stale-trip message and reloads; 401 goes to sign-in; 422 shows a field-level or generic validation message; no change is lost silently.
  6. Archived trips render read-only exactly as today.
  7. `npm run typecheck`, `npm run lint`, `npm run test` pass (incl. `tests/i18n.test.ts` and `tests/docs.test.ts`); manual browser check of the golden path.
- Security and migration risks: no new endpoint, no migration. All writes go through the existing owner-scoped API. All user text is rendered through React (no HTML injection). Draft state is not persisted anywhere.
- Rollback approach: revert the PR; no data shape changed, so trips edited with it remain valid.
- Budget: max agent invocations 0 (Single-Agent First); stop condition: any need to change the API → stop and ask the owner.
- State: REVIEW
- Feature document owner (`docs/features/<slug>.md` + `.vi.md`, CLAUDE.md rules 11–12): main session — `docs/features/trip-editor.md` + `.vi.md`.
- Architecture/usage doc updates needed (`docs/architecture.*`, `docs/usage.*`, rule 10): check `docs/architecture.*` Phases wording about "full Planner trip editor still absent" and `.claude/context/project-context.md` "Still absent" block; update both if they now say the editor is absent.
