# ADR 0029 — Member map: a private national map built from the member's own trips

🇻🇳 Bản tiếng Việt: [0029-member-map.vi.md](0029-member-map.vi.md)

- **Status:** Accepted (slice 1: private map). Slice 2 (sharing by token) is sketched here and needs its own ADR amendment and a security check before any code.
- **Date:** 2026-11-20
- **Owner:** system-architect
- **Affects:** `src/server/planner/member-map.ts`, `src/app/[locale]/my-map/page.tsx`, `src/components/map/member-map-view.tsx`, the prop type of `VietnamMap`, `src/i18n/routing.ts`, `messages/*.json`, the account menu and `/my-trips`, `next.config.ts` (one header rule), the wording of rule 6 in `CLAUDE.md` and `.claude/rules/03-project-chuyen-nha-hung.md`. No database, migration or API. Task Contract `member-map`; builds on [ADR 0004](0004-planner-identity.md), [ADR 0022](0022-home-mvp-server-session.md) and, for slice 2, [ADR 0025](0025-member-profiles-and-use-this-trip.md).

## Context

`/map` is the site owners' own journey: it reads the `destinations` seed, whose `visits` are the owners'. A signed-in member has no map of their own, although the Planner already knows where they have been and where they plan to go. The owner decided (2026-11-20): a member sees their own map on a separate page; `/map` does not change; a trip counts as "been" once `completed`, even if archived afterwards.

Rule 6 lists "the Planner map" as deliberately deferred. The text never defined it. Read narrowly it is a map *inside* the Planner (activity pins, day routes, in the trip editor); read broadly it is any map fed by Planner data. The owner chose the narrow reading: seeing where I have been is a read-only, country-level projection of trips and reviews that already exist.

## Decision

1. **Scope split of "Planner map".** *Member map* — a country-level, read-only projection of the member's own trips and reviews — ships under this ADR. *Trip route map* — activity pins, day routes, anything inside the trip editor — stays deferred and needs its own ADR. Rule 6 and `03-project-chuyen-nha-hung.md` are reworded accordingly.
2. **A separate page.** `/my-map` (VI `/ban-do-cua-toi`), `noindex`, dynamic (`force-dynamic`) and answered `Cache-Control: private, no-store` by a `next.config.ts` rule. `/map` is unchanged and never reads a session.
3. **Source and rule, per destination known to the `destinations` seed** (anything else is dropped):
   - *Visited* (solid dot, `visits` ≥ 1): a trip with `planningStatus = completed` — **archived or not** — or a review of the member's own with a `visitedOn`.
   - *Planned* (hollow dot, no `visits`): an `active` trip with `draft` or `planned`, when nothing is visited there.
   - An `archived` trip that is not `completed` does not appear.
   - `visits` = completed trips + distinct `visitedOn` days, where a review day inside a completed trip's own dates at the same destination is not counted again, and `rejected`/`removed` reviews are ignored. A `visitedOn` is self-declared, so it is used only to draw the member's own map.
4. **Data path.** The page reads the cookie session on the server, as `home-page.ts` does (cheap token-shape filter, `identify`, any failure → `guest`), then `listTrips(userId)` (active and archived, paged) and `listOwnReviews(userId)`; a review's place maps to its destination through the public place catalogue. No API route is added.
5. **Allow-list.** Only `{ slug, visits? }` per point reaches the component. Name, coordinates, `featured` and label side come from the seed, read-only (`destinations.ts` is not edited). Never the owner, a trip id or title, a note, a budget, a share token or review text. Permanent labels stay on `featured` destinations only; pins keep their 44 px targets.
6. **A guest** gets the empty outline, the sentence "plan and take your trips to fill in your map" and a sign-in button — nobody's data. A member with no point yet gets the same sentence and a link to start a trip.
7. **Slice 2 — sharing by token (not built).** The map gets its **own** share token (never a trip's token), private by default, revocable and rotatable; the public page returns only the allow-listed `{ slug, visits }` plus a display name under the same rule as ADR 0025 (`anonymous` always wins; anonymous by default); `noindex`, `Referrer-Policy: no-referrer`. It needs a per-user share setting (table/column, migration, export/import), `PUT`/`DELETE` share routes, a `/shared-map/[token]` page, deletion with the user, a rate limit and tests proving nothing else leaks. It is XL and requires `/sec-check`.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): a separate `/my-map` | `/map` stays the owners' journey and statically cacheable; no mix-up of whose data it is | One more page |
| B: `/map` changes with the session | No new route | Loses the static page, mixes the owners' and the member's data, a visitor may take it for the owners' journey |
| C: a manual "I've been here" switch | Exact | New schema and API; out of scope |
| D: a map of each trip's route | Richer | It is the deferred trip route map |

## Consequences

- Easier: a member sees their own footprint with no new storage; slice 2 has a clear shape.
- Harder: the page reads the whole trip list of one member (paged, up to 1,000 trips per status) on each request; a very large account would need an index or an API. The count of visits is approximate by design.
- A trip that is completed and then archived stays on the map; one archived without completing disappears, which a member may not expect — the page says so.
- The "Planner map" wording is now two things; other documents that say "Planner map" (roadmap, specs) mean the trip route map.
- Rollback: pure addition — revert the PR.
