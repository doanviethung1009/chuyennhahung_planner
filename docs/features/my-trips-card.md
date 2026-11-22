# Feature — My Trips card

🇻🇳 Bản tiếng Việt: [my-trips-card.vi.md](my-trips-card.vi.md)

## Summary

The trip list on the member home (`/my-trips?tab=trips`) is reorganised into cards with a
header, a body and a footer, so a traveller can recognise a trip, open it, and find the
secondary actions without a row of buttons. Task: UI-MYTRIPS-1. No business behaviour
changed.

## Routes

None. The list stays on `/my-trips` (`/chuyen-di-cua-toi`, `/en/my-trips`), `?tab=trips`.

## Data

Only fields already on `Trip`: `title`, `destinationSlug`, `startDate`, `durationDays`,
`partySize`, `visibility`, `planningStatus`, `version`. Messages: `myTrips` (new keys
`open`, `menuLabel`, `retry`) and `planning`, in both `vi.json` and `en.json`.

## How it works

- **Header:** the title (link to `/my-trips/[id]`), a planning-status badge and a
  visibility badge (both carry text, not only colour), and a `…` menu button.
- **Body:** destination · start date or "dates open" · days · travellers, wrapping on
  narrow screens.
- **Footer:** primary link "View / edit trip" (full width on mobile). On the archived
  filter it also holds "Restore" and the inline permanent-delete confirmation.
- **Action menu** (`action-menu.tsx`, ARIA menu button): active trips list the three
  planning statuses (radio items, current one checked), Duplicate and Archive; archived
  trips list Permanently delete, which still opens the confirmation before any request.
  Arrow keys, Home and End move, Escape closes and returns focus, Tab or a press outside
  closes. The trigger is disabled while a request runs.
- **States:** loading placeholder (`aria-busy`), empty states with the existing CTA,
  load failure as an alert with a Retry button, action failures as an alert; success
  messages stay in the polite status region.
- Requests are unchanged: PATCH (status), POST `/duplicate`, DELETE (archive), POST
  `/restore`, DELETE `?purge=true`, each with `If-Match` of the loaded `version`; 401
  goes to sign-in, 412 shows the stale message and reloads.

## Files

| Path | Role |
|---|---|
| `src/components/planner/my-trips.tsx` | List, cards, actions |
| `src/components/planner/action-menu.tsx` | Accessible disclosure menu |
| `messages/vi.json`, `messages/en.json` | `myTrips.open`, `menuLabel`, `retry` |
| `tests/dom/my-trips.test.tsx` | Component tests |

## Tests

`tests/dom/my-trips.test.tsx` (jsdom): metadata, CTA route, actions per filter, menu
keyboard/Escape/outside press, status PATCH with version, duplicate and navigation,
archive and restore requests, purge confirmation, 401/412/500, disabled while busy,
loading/empty/load-failed with retry, English labels. Visual checks at 375/768/1280 need
a signed-in session and are not automated.

## Limits and open questions

No search, sorting or pagination. The default tab (`map`) is unchanged (ADR 0032). The
`StatusSelect` control is no longer used on this list; it remains for other screens.
