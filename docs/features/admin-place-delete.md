# Feature — Admin place delete

🇻🇳 Bản tiếng Việt: [admin-place-delete.vi.md](admin-place-delete.vi.md)

## Summary

Admins and super admins can permanently delete a place from its edit page in the admin portal. Editors and members never see the control, and the API refuses them. A place that content or traveller data still refers to is not deleted: the page says what still uses it, with counts. Decision: [ADR 0028](../adr/0028-content-delete-action.md); contract `CORE-10`.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/content/places/[slug]` (existing page, new "Danger zone") | `/quan-tri/noi-dung/dia-diem/[slug]` | `/en/admin/content/places/[slug]` |
| `DELETE /api/admin/travel/places/[slug]` (existing API, now also a session) | same | same |

## Data

Reads the `adminContent.places.delete.*` and `adminContent.errors.{place_in_use_counts,usage_*}` message keys, and `adminRoles.actions.content_delete` for the roles matrix. The 409 body carries `error.details.counts` (stories, collections, templates, contentReviews, tripActivities, communityReviews), numbers only.

## How it works

The server page calls `can(principal, 'content:delete')` and passes `canDelete` to `PlaceEditor` → `RecordShell`, which renders `DeletePlace` only when true. The button opens a native modal `<dialog>` (focus trap, Esc closes, focus returns); "Delete permanently" sends `DELETE` to the place URL with the session cookie. 204 → back to the places list. A refusal closes the dialog and shows an alert next to the button: 409 lists the kinds that still use the place (only counts above zero), 403 and 503 use the existing error messages. The API route is the real check: `adminContentRoute(..., { action: 'content:delete', session: true })`, so a session needs same-origin proof, is rate-limited and must hold the action; the service token still works.

## Files

| Path | Role |
|---|---|
| `src/server/identity/permissions.ts` | The `content:delete` action: admin, super admin, service |
| `src/app/api/admin/travel/places/[slug]/route.ts` | `DELETE` opts in to sessions |
| `src/components/admin/content/delete-place.tsx` | Danger zone, confirm dialog, error alert |
| `src/components/admin/content/record-shell.tsx`, `place-editor.tsx` | `canDelete` prop, placement |
| `src/components/admin/content/use-record.ts`, `src/components/planner/api.ts` | `ApiError.details` and the `place_in_use` message with counts |
| `src/app/(admin)/[locale]/admin/content/places/[slug]/page.tsx` | Server-side `canDelete` |
| `messages/vi.json`, `messages/en.json` | Strings in both languages |

## Tests

- `tests/place-delete-session.test.ts`: the permission matrix; admin and super admin session → 204; editor and member → 403; no cookie → 401; cross-site → 403; token → 204; 409 with counts for an admin session.
- `tests/dom/delete-place.test.tsx`: no control without `canDelete`; a real labelled button of at least 44px; cancel makes no request; confirm sends `DELETE` and returns to the list; 409 shows only non-zero counts in an alert; 403 message.
- `tests/place-delete-postgres.integration.test.ts` (needs `TEST_DATABASE_URL`, otherwise skipped = NOT RUN): the route on PostgreSQL stores for 204, 404, 409 (content, trip activities, community reviews) and fail-closed 503.
- `tests/admin-roles-matrix.test.ts` (existing): the new action has a label in both languages.

## Limits and open questions

- Permanent: no soft delete or undo. The two stores are not one transaction when separate, so a trip adding the place in between is possible; `GET /api/admin/planner/integrity` is the backstop.
- Places only; stories, reviews, collections and templates stay token-only for `DELETE`.
- After a successful delete the list page shows no "deleted" banner; the place is simply gone from the list.
