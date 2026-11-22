# Feature — Member map

🇻🇳 Bản tiếng Việt: [member-map.vi.md](member-map.vi.md)

## Summary

A signed-in member sees their own map of Vietnam: solid dots where they have been, hollow dots where they have planned to go. It is private, separate from the owners' [travel map](travel-map.md), and built only from trips and reviews the member already has. Decision: [ADR 0029](../adr/0029-member-map.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/my-trips` (member home: map above the trip list) | `/chuyen-di-cua-toi` | `/en/my-trips` |

`noindex`, not in the sitemap, always answered `Cache-Control: private, no-store`. The map used to be its own page `/my-map`; [ADR 0031](../adr/0031-member-home-merge.md) merged it into My Trips. `/ban-do-cua-toi` and `/en/my-map` redirect (308) to it. The page is a server page; a guest sees the empty map and the sign-in button and the trip list is not mounted. The account menu has one entry.

## Data

- Reads the member's trips (`listTrips`: `destinationSlug`, `status`, `planningStatus`, `startDate`, `endDate`) and own reviews (`listOwnReviews`: `placeSlug`, `visitedOn`, `status`), both scoped to the session's `userId`, plus the public place catalogue to map a review's place to its destination.
- Coordinates, names, `featured` and label side come from the `destinations` seed, read-only. No new field, table or API. Message namespace `memberMap`; `myTrips.listTitle`.
- Nothing real is needed from the owner, and no member data is invented.

## How it works

- `getMemberMap()` reads the cookie on the server (shape filter, `identify`; a bearer token, an expired session or a pending password change is a guest; any failure is a guest) and returns `guest`, `empty` or `ready` with points `{ slug, visits? }`.
- `buildMemberMapPoints` is the pure rule: a `completed` trip (archived or not) or a review with `visitedOn` makes a solid dot, with `visits` = completed trips + distinct visit days not already inside a completed trip's dates; an `active` `draft`/`planned` trip makes a hollow dot; an archived trip that is not completed is dropped; a destination not in the seed is dropped.
- `MemberMapView` joins the points to the seed by `slug` and renders `VietnamMap`. A guest gets the bare outline, a sentence and a sign-in button; an empty member gets the sentence and a link to create a trip. Permanent labels stay on `featured` pins only; pins keep 44 px targets; the legend and the list say "visited" / "planned" in words, not only by colour.

### Tabs on the member home ([ADR 0032](../adr/0032-member-home-tabs.md))

`/my-trips` shows one section at a time: **Map**, **Trips** (default), **Sharing**, chosen by `?tab=map|trips|share` read on the server (a missing or unknown value falls back to Trips, a repeated parameter uses its first value; the value is never echoed). The tab bar is a `<nav aria-label>` of real links with `aria-current="page"` (no ARIA tablist), so deep links, Back and no-JavaScript browsers work. Each tab reads only its own data (`getMemberMap`, `getMemberMapShareOverview`, or `getMemberSession` for Trips). A guest gets the empty map and sign-in on every tab, with no tab bar. The Trips filter (Active / Archived) is a filter, not a tab.

Stable selectors for end-to-end specs, by role and name from `messages/*.json`: `navigation` "Các mục của trang chuyến đi" / "Sections of the trips page" with links Bản đồ / Chuyến đi / Chia sẻ (Map / Trips / Sharing); URLs `/chuyen-di-cua-toi?tab=share`, `/en/my-trips?tab=trips`; `data-testid="share-state"`, `share-preview`, `share-unfinished` are kept.

## Files

| Path | Role |
|---|---|
| `src/server/planner/member-map.ts` | The pure rule, the session read and the allow-list |
| `src/app/[locale]/my-trips/page.tsx` | The member home: `noindex`, dynamic, one `<h1>`, map then trip list |
| `src/components/map/member-map-view.tsx` | Guest / empty / ready view |
| `src/components/map/vietnam-map.tsx` | Prop type narrowed to `MapPin` (output unchanged) |
| `next.config.ts` | `private, no-store` on `/chuyen-di-cua-toi` and `/en/my-trips`; 308 redirects from the old map URLs |
| `tests/member-map.test.ts`, `tests/member-map-view.test.ts` | Tests |

## Tests

`member-map.test.ts`: every rule case of the pure function; guest for a missing, garbage, unknown or bearer cookie and a pending password change; no store read for a malformed cookie; two members never see each other's data; the keys handed to the component are only `slug` and `visits`, with no owner, trip id or title. `member-map-view.test.ts`: guest and empty views draw no pin; solid and hollow pins with text states; 44 px targets; one permanent label (featured only); `VietnamMap` renders identically for whole destinations and their projection. Not tested: the `Cache-Control` header at runtime (checked in the build output only) and a browser run.

## Limits and open questions

- Reads up to 1,000 trips per status on each request; a very large account would need an index.
- Each request makes about 21 snapshot reads on the JSON store (active and archived trips paged by 100, plus reviews and places), uncached; fine at today's size, but a busy site or a large account would need a short per-user cache or one scoped query (security check, warning 2).
- `visitedOn` is self-declared; it only draws the member's own map.
- No sharing yet: a token-shared map is slice 2 (ADR 0029, item 7), which needs a security check.
- No trip route map: that stays deferred.
- The owners' map and its pin and label rules are in [travel-map.md](travel-map.md); this page reuses them and does not edit that document.
