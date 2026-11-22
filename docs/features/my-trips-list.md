# Feature — My Trips list: view in the URL, find and sort

🇻🇳 Bản tiếng Việt: [my-trips-list.vi.md](my-trips-list.vi.md)

## Summary

The trip list on the member home (`/my-trips?tab=trips`) gets a shareable "Current /
Archived" view, one switch pattern shared with the member home sections, consistent
wording, and search, status filter and sort. Task: UXS-3 (finishes UI-MYTRIPS-1, which
shipped the cards in [my-trips-card.md](my-trips-card.md)); audit findings UXA-13, 14, 20.

## Routes

None added. The archived view is `/my-trips?tab=trips&view=archived`
(`/chuyen-di-cua-toi?tab=trips&view=archived`). Anything else for `view` is the default
(current); a repeated parameter uses its first value.

## Data

No new data and no API change. `view` is read on the server (`src/lib/trips-view.ts`,
same idea as `parseMemberHomeTab`, ADR 0032) and passed to `MyTrips`, which still
loads `GET /api/planner?status=…`. Messages: `myTrips` gains `findLabel`,
`searchLabel`, `filterStatus`, `filterAll`, `sortLabel`, `sortUpdated`, `sortStart`,
`sortTitle`, `resultCount`, `noMatch`, `clearFilters`; `tabActive` and `description`
are reworded, in both `vi.json` and `en.json`.

## How it works

- **View switch:** two real links in a `<nav>` with `aria-current="page"` on the open
  one (the same pattern as `member-home-tabs.tsx`), replacing the `aria-pressed`
  buttons. Back, Forward and F5 keep the view; the page remounts the list per view
  (`key`), so search and filters reset when switching.
- **Wording:** "Đang dùng" becomes "Hiện có" / "Current"; the page description says
  "archive" instead of "put away" so the text and the button agree.
- **Find and sort (client-side, over the loaded list):** a search box (title and
  destination name, case-insensitive), a planning-status filter, and a sort (recently
  updated = server order, start date with undated trips last, name A–Z). When a filter
  is active a status line says "Showing x of y"; no match shows a message and a
  "Clear filters" button. Filters are not in the URL.
- Load failure with Retry, the card actions and their requests are unchanged.

## Files

| Path | Role |
|---|---|
| `src/lib/trips-view.ts` | `TRIPS_VIEWS`, `parseTripsView` |
| `src/app/[locale]/my-trips/page.tsx` | reads `?view=`, passes it to `MyTrips` |
| `src/components/planner/my-trips.tsx` | view links, search, filter, sort |
| `messages/vi.json`, `messages/en.json` | new and reworded `myTrips` keys |
| `tests/dom/my-trips.test.tsx`, `tests/trips-view.test.ts` | tests |

## Tests

`tests/dom/my-trips.test.tsx`: view links and `aria-current`, `?view=archived` href,
sort, search with no match and clear, status filter without extra requests; the existing
card tests now mount per view. `tests/trips-view.test.ts`: parsing. Not covered:
VoiceOver on the status line (audit B9) and a screenshot pass at 375/768/1280.

## Limits and open questions

No server-side search or pagination (the list is small, loaded in full). Filters are not
kept in the URL. The status message still sits at the top of the list rather than on the
card that changed (UXA-13, left open). The admin account view still says "Đang dùng"
(`admin…viewActive`), a different concept.
