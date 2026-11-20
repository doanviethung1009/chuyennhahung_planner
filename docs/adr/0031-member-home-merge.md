# ADR 0031 — Member home: the member map and My Trips become one page

🇻🇳 Bản tiếng Việt: [0031-member-home-merge.vi.md](0031-member-home-merge.vi.md)

- **Status:** Proposed (awaiting the owner)
- **Date:** 2026-11-20
- **Owner:** system-architect
- **Affects:** `src/app/[locale]/my-trips/page.tsx`, removal of `src/app/[locale]/my-map/page.tsx`, `src/components/map/member-map-view.tsx`, `src/i18n/routing.ts`, `src/lib/return-to.ts`, `src/components/layout/account-menu.tsx`, `messages/*.json`, `next.config.ts` (redirects and the private header paths). Task Contract `member-home-merge`. Amends [ADR 0029](0029-member-map.md) (the page location) and [ADR 0030](0030-member-map-sharing.md) (where the share controls live).

## Context

The member map (`/my-map`) and My Trips (`/my-trips`) show two views of the same trips: completed ones are "been", draft and planned ones are "planned". A member has to visit two pages, linked to each other, for one idea. The owner asked for one page.

The two pages differ technically. `/my-map` is a dynamic server page that reads the session cookie, answers `private, no-store`, and shows a guest an empty map. `/my-trips` is a client component that calls `GET /api/planner` and sends a guest to sign-in on a 401.

## Decision

1. **One page, at `/my-trips`** (VI `/chuyen-di-cua-toi`): the map first, the trip list below. No view toggle: a toggle hides one of two things the member wants, and adds client state.
2. **`/my-trips` becomes a server page**, `force-dynamic`, `noindex`, answered `Cache-Control: private, no-store` by `next.config.ts`. It reads `getMemberMap()` for the map; the list stays the existing client `MyTrips` calling `GET /api/planner` — no API change.
3. **A guest** gets the empty map and the sign-in button, and `MyTrips` is **not mounted** (it would redirect to sign-in on its 401 and break the ADR 0029 rule that a guest sees an empty map). A member with no trip gets the map prompt and the list's own empty state.
4. **`/my-map` goes away.** `/ban-do-cua-toi` → `/chuyen-di-cua-toi` and `/en/my-map` → `/en/my-trips`, `permanent: true` (308) in `next.config.ts`, tested like the tour redirects. `/my-map` leaves `pathnames`; the account menu has one entry, and every internal link moves to `/my-trips`. `/my-trips/new` and `/my-trips/[id]` are unchanged.
5. **Invariants kept:** allow-list `{ slug, visits? }` only; `destinations.ts` and `/map` untouched; `/shared-map/[token]` untouched; sign-out is a full navigation so the router cache cannot show the old member's page.
6. **Sharing (ADR 0030 slice 2c)** stays inside the map block of this page.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): map above the list at `/my-trips`, redirect `/my-map` | One page, no client state, both views visible | Longer page on mobile |
| B: Map / List toggle | Shorter page | Hides one view; needs client state and a URL for each |
| C: keep `/my-map` as home, move the list in | The map is the headline | `/my-trips/*` would hang under a different parent; more redirects |
| D: keep two pages | No work | The owner's complaint |

## Consequences

- Easier: one entry in the menu; one place for the share controls.
- Harder: `/my-trips` loses static caching (it was a thin shell); the server reads the member's trips and reviews on each request, as `/my-map` already did.
- Old bookmarks and a stale `returnTo` still work through the 308.
- Rollback: revert the PR; the redirects go with it.
