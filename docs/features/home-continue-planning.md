# Feature — Home: first trip and Continue Planning

🇻🇳 Bản tiếng Việt: [home-continue-planning.vi.md](home-continue-planning.vi.md)

## Summary

A signed-in member now sees one extra band above the hero on the home page. With no
trip yet it invites them to **create the first trip**; with a finished or archived-only
history it offers **a new trip**; with an unfinished trip it shows **Continue Planning**:
the trip's title, destination, length, a countdown if it has a date, its status, and a
button into the trip editor. A guest, a crawler, or anyone with an invalid session sees
the home page exactly as before. Stories, destinations, community trips and reviews are
unchanged for everyone.

## Routes

No new route. The band links to existing ones:

| Internal | Vietnamese | English |
|---|---|---|
| `/` | `/` | `/en` |
| `/my-trips/new` | `/chuyen-di-cua-toi/moi` | `/en/my-trips/new` |
| `/my-trips/[id]` | `/chuyen-di-cua-toi/[id]` | `/en/my-trips/[id]` |
| `/my-trips` | `/chuyen-di-cua-toi` | `/en/my-trips` |

## Data

No new table, endpoint or migration. The home page reads the Planner the way the admin
pages do: the `planner_session` cookie, `identify`, then `listTrips` (active, plus
archived with `limit: 1` only when there is no active trip). Messages under
`home.member` in both catalogues.

`readHomeMember()` returns `guest`, `first-trip`, `next-trip` or `continue`; the last
carries a `ContinueTrip` with exactly seven fields (`id`, `title`, `destinationSlug`,
`durationDays`, `startDate`, `daysUntilStart`, `planningStatus`). Owner, share token,
note, budget and version never leave the server module.

## How it works

- **Server only.** [`readHomeMember`](../../src/server/planner/home-page.ts) reads the
  cookie, forwards only the cookie to `identify`, and falls back to `guest` on any
  failure, a pending password change, or a bearer-style identity
  ([ADR 0022](../adr/0022-home-mvp-server-session.md)). The band is a server component
  with no client JavaScript, so it is in the first response — no skeleton, no layout shift.
- **Which trip.** [`pickContinueTrip`](../../src/lib/home/continue-trip.ts): never a
  `completed` trip; earliest start date from today (Vietnam calendar day); else the most
  recently updated undated trip; else the most recently updated past-dated one; ties by
  `updatedAt` then `id`.
- **Public page unchanged.** `generateMetadata`, the layout and the header read no
  request data; a request without the cookie renders the same HTML as before.
- **Caching.** A request that carries the cookie is answered
  `private, no-cache, no-store` by Next's dynamic rendering (checked on a production
  build); no `next.config.ts` rule was needed.

## Files

- `src/server/planner/home-page.ts` — `readHomeMember`, `resolveHomeMember`
- `src/lib/home/continue-trip.ts` — `pickContinueTrip`, `daysUntil`, `vietnamToday`
- `src/components/home/home-member-band.tsx` — the band
- `src/app/[locale]/page.tsx` — one read and one component above `<Hero />`
- `messages/vi.json`, `messages/en.json` — `home.member.*`

## Tests

- `tests/home-continue-trip.test.ts` — the picker, tie-breaks, the Vietnam day.
- `tests/home-member.test.ts` — guest, garbage cookie, bearer token, pending password,
  first/next/continue, the exact key set, isolation between two members, store failure.
- `tests/home-page-boundary.test.ts` — the one exception does not spread to the layout,
  header, metadata or other pages.

## Limits and open questions

- No activity count or progress in the band: it would need a full trip read.
- Onboarding steps, "For you", community activity and saved items are the larger
  [personalization spec](../specs-home-personalization.md), not built.
- If a CDN or shared cache is ever put in front of `/`, it must bypass the cache for
  requests with the session cookie, or the home page must move to the client-island
  design of [ADR 0021](../adr/0021-personalized-home.md) (spec question Q5).
- The member band was checked in a browser on a production build in Vietnamese and
  English at phone and desktop widths; `/qc-check` and `/sec-check` have not been run.
