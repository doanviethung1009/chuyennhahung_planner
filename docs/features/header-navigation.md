# Feature — Header navigation

🇻🇳 Bản tiếng Việt: [header-navigation.vi.md](header-navigation.vi.md)

## Summary

The header, drawer and footer now lead to every part of the site in one click.
Places, trip templates and the site map used to live only in the footer; the main
navigation groups them under **Explore** (destinations, places, Hưng's map) and
**Plan a trip** (itineraries, trip templates). The call to action goes where the
visitor can act: a guest still lands on the planner page, a signed-in member on
the new-trip page. Switching language keeps the query string and the sign-in
`returnTo`. This is UXS-2 of the UI/UX audit (UXA-01, 02, 04, 05, 06, 16, 18, 21;
decisions UXD-1, 2, 4, 8 confirmed by the owner).

## Routes

None. Links to existing routes only; no route was added or renamed.

| Internal | Vietnamese | English |
|---|---|---|
| `/destinations`, `/places`, `/map` | `/kham-pha`, `/dia-diem`, `/ban-do` | `/en/destinations`, `/en/places`, `/en/map` |
| `/itineraries`, `/trip-templates` | see `src/i18n/routing.ts` | see `src/i18n/routing.ts` |
| `/plan-your-trip` (guest CTA) | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |
| `/my-trips/new` (member CTA) | `/chuyen-di-cua-toi/moi` | `/en/my-trips/new` |

## Data

Messages under `nav`: `groupExplore`, `groupPlan`, `createTrip` (new); `destinations`
("Điểm đến"), `itineraries` ("Lịch trình") and `map` ("Bản đồ nhà Hưng" / "Hưng's map")
reworded so a group label never repeats its first entry and the site map is not
confused with the member's own map. `footer.planHeading` is new.
`myTrips.sectionMap` became "Bản đồ của bạn" / "Your map" (message only; the page is
untouched). Nothing is stored.

## How it works

- `nav-items.ts` holds `primaryNav` as links and groups; `primaryLinks` flattens it.
- **Desktop (from 1280px):** one row. A group is a button with `aria-expanded` that
  opens a short list of links (a disclosure, not an ARIA menu): Escape closes and
  returns focus, the arrow keys move between entries, any navigation closes it, and
  the group is underlined when one of its pages is current. Links carry
  `aria-current="page"`.
- **Drawer (below 1280px):** a flat list, each group labelled, so every page is one tap.
- **CTA:** `MainNav` already reads the session. A guest gets "Plan your trip" →
  `/plan-your-trip`; a member gets "Create a trip" → `/my-trips/new`. While the session
  loads the slot is held but invisible and out of the tab order, so a member never sees
  the guest label flip; with scripting off the guest link shows.
- **Sign-in:** icon below 1536px, icon plus the word from 1536px. The header container
  is widened to `screen-2xl` from that width.
- **Language:** the links stay real `<a>` elements. The server renders the page path;
  after hydration the current query is appended (read through `useSyncExternalStore`,
  not `useSearchParams`, which would make every page dynamic) and refreshed on
  pointer-down and focus.
- **Footer:** three themes: Explore, Plan a trip, About. "My trips" left the footer (a
  static footer cannot know the session, and a guest got a sign-in page); members use
  the account menu. The header tagline is 12px.

Measured in the integrated browser (dev server, header row, one line, 44px targets,
no overlap, no horizontal scroll):

| Width | VI | EN |
|---|---|---|
| 1024, 1180 | drawer | drawer |
| 1280 | 13px spare | 53px spare |
| 1440 | 21px spare | 133px spare |
| 1536 | 51px spare, sign-in word shown | 149px spare |

## Files

| Path | Role |
|---|---|
| `src/components/layout/nav-items.ts` | `primaryNav` (links and groups), `primaryLinks` |
| `src/components/layout/main-nav.tsx` | `NavDropdown`, desktop row, drawer, CTA choice |
| `src/components/layout/site-header.tsx` | Resolves labels, passes both CTAs, widens the container at 2xl |
| `src/components/layout/account-menu.tsx` | Sign-in word from 2xl |
| `src/components/layout/locale-switcher.tsx` | Keeps the query |
| `src/components/layout/site-footer.tsx` | Three columns |
| `messages/vi.json`, `messages/en.json` | `nav.*`, `footer.planHeading`, `myTrips.sectionMap` |

## Tests

- [`routing.test.ts`](../../tests/routing.test.ts) — every nav entry and group exists
  in both catalogues; places, templates and the map are in the primary links.
- [`header-account.test.ts`](../../tests/header-account.test.ts) — CTA by session,
  hidden slot while loading, sign-in word from 2xl, group disclosure, no text under 12px,
  footer columns, no sign-in surprise for guests.
- [`dom/main-nav.test.tsx`](../../tests/dom/main-nav.test.tsx) — guest and member CTA,
  no label flip, group opens with the right links, `aria-current`, Escape.
- [`dom/locale-switcher.test.tsx`](../../tests/dom/locale-switcher.test.tsx) — query and
  `returnTo` kept; plain page link before hydration.
- The measurements above were taken by hand; drawer focus trapping on a production
  build is still UXS-7.

## Limits and open questions

- At 1280px in Vietnamese only 13px is spare: a longer label or a seventh entry would
  need another grouping or a later breakpoint.
- Group triggers open on click, not hover.
- The locale link reads the address bar after hydration; before that (or without
  JavaScript) it is the query-less page.
- `returnTo` is kept verbatim, so it still names the page in the previous language; the
  sign-in page accepts either.
- Members reach "My trips" from the account menu only; the footer no longer links it.
- At 2xl a guest's sign-in slot grows from 44px to the word while the session loads.
