# Feature — Admin user search and role filter

🇻🇳 Bản tiếng Việt: [admin-user-filter.vi.md](admin-user-filter.vi.md)

## Summary

A search box and a role filter above the users table in the admin portal, so an
administrator can find one person in a long list. Filtering happens in the browser
over the list already loaded; no API call is added or changed. It builds on
[admin-portal.md](admin-portal.md).

## Routes

None. It lives on the existing `/quan-tri` (`/en/admin`) page.

## Data

- Reads the `AdminUser[]` the page already holds: `handle`, `displayName`, `email?`, `role?` (absent reads as `member`).
- Messages: new keys in `admin.users` (`searchLabel`, `searchPlaceholder`, `filterRoleLabel`, `filterRoleAll`, `filterClear`, `filterResult`, `filterEmpty`) in both `messages/vi.json` and `messages/en.json`.

## How it works

1. `UserTable` keeps two pieces of state, the query and the role filter, and renders `filterUsers(users, query, role)`.
2. The query matches display name, handle or email by substring, case-insensitive and ignoring Vietnamese diacritics (`đ` counts as `d`), so "hung" finds "Hưng".
3. The role filter offers all roles plus member, editor and admin; a user with no `role` counts as member. Query and role combine with AND.
4. While a filter is active, a `role="status"` line announces "Showing x of y", and a Clear filters button resets both. If nothing matches, the table is replaced by a short message.
5. Row actions (role change, reset password) work on filtered rows exactly as before; drafts and confirm state are keyed by user id and survive filtering.

## Files

| Path | Role |
|---|---|
| `src/components/admin/filter-users.ts` | Pure `normalizeSearch` and `filterUsers` |
| `src/components/admin/user-table.tsx` | Search input, role select, result line, empty state |
| `messages/vi.json`, `messages/en.json` | New `admin.users` keys |
| `tests/admin-user-filter.test.ts` | Unit tests for the filter |

## Tests

`tests/admin-user-filter.test.ts` asserts the empty query, matching on name, handle and email, diacritic and case folding, the missing-role-as-member rule, query and role combined, and `đ` folding. `tests/i18n.test.ts` checks key parity. Not tested: the interaction in a browser (no DOM test runner is installed).

## Limits and open questions

- Client-side only: it searches the loaded list, so it is as complete as that list (there is no pagination today).
- Substring match, no ranking or fuzzy matching.
- The filter state is not kept in the URL and resets on reload.
