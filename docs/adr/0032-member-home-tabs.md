# ADR 0032 — Member home tabs: the member home shows one section at a time, chosen by `?tab=`

🇻🇳 Bản tiếng Việt: [0032-member-home-tabs.vi.md](0032-member-home-tabs.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-21
- **Owner:** system-architect
- **Affects:** `src/app/[locale]/my-trips/page.tsx`, new `src/components/planner/member-home-tabs.tsx` and `src/lib/member-home-tab.ts`, `src/components/map/member-map-share-panel.tsx`, `member-map-view.tsx`, `src/server/planner/member-map.ts` (`getMemberSession`), `member-map-share-preview.ts` (overview), `messages/*.json`. Task Contract `member-home-tabs`. Amends [ADR 0031](0031-member-home-merge.md) §1; no change to ADR 0029 or 0030 rules.

## Context

ADR 0031 put the map above the trip list on one page, rejecting a toggle because it "hides one view and needs client state". With sharing (ADR 0030) the page grew to four sections before the first trip. The owner said scrolling it is distracting and asked for tabs.

Separately, the owner suspected the shared map shows no data. It does not: it shows completed trips by design (ADR 0030 §2). What was missing was an explanation to the owner of why a planned trip is not on it.

## Decision

1. **Three sections: Trips (default), Map, Sharing.** One at a time, one `<h1>` for the page, one `<h2>` per section.
2. **The section is `?tab=map|trips|share`, read on the server** (`searchParams`). A missing or unknown value is the default and a repeated parameter uses its first value; the raw value is never echoed. The page was already dynamic and private, so nothing is lost to caching. Deep links, Back/Forward and no-JavaScript browsers work; `returnTo` already keeps the query for `/my-trips`.
3. **Real links, not an ARIA `tablist`.** A `<nav>` of three links, `aria-current="page"` on the open one, targets ≥44px. Each section is its own URL answered by the server, so the tablist pattern (roving tabindex, arrow keys, client state) would be both heavier and the wrong semantics.
4. **Each section reads only its own data.** Map: `getMemberMap`. Sharing: `getMemberMapShareOverview` (the public preview plus one number). Trips: `getMemberSession` (`identify` only) and the client `MyTrips`. A guest sees the empty map and sign-in on every tab, with no tab bar, and `MyTrips` and the share panel are not mounted (ADR 0029 and 0031 invariants kept).
5. **Explain the shared map, change no data.** The Sharing section tells the owner how many active trips are not completed (a count, owner-only) with a link to Trips; the sparse (<2) warning shows before the enable button; the Map legend says hollow points are not shared; the public empty text becomes neutral and still reveals nothing. `PublicMemberMap`, the buckets, the token and the 404 rule are untouched.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) `?tab=` on the server, links | Deep link, Back, no JS, no client state, no new route | A tab change is a server navigation |
| B ARIA tablist with client state | Instant switch, arrow keys | JS, state, URL sync, more tests, wrong semantics for URLs |
| C Path per tab (`/my-trips/map`) | Clean URLs | Collides with `/my-trips/[id]`; new `pathnames` and redirects |
| D URL hash | Simple | The server cannot read it; no-JS broken |
| E Show planned trips on the shared map | Fuller map | Discloses where the member will be; rejected in ADR 0030 |

## Consequences

- Easier: a focused view; the trips list loads only when opened; one place for sharing controls with its preview.
- Harder: a tab change re-renders the page on the server; E2E specs must select by role and name (see the feature document).
- Rollback: revert the PR; no migration, API or data change. Old `?tab=` links are ignored and the single page returns.
