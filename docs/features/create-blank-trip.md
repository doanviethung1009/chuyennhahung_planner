# Feature — Create a blank trip

🇻🇳 Bản tiếng Việt: [create-blank-trip.vi.md](create-blank-trip.vi.md)

## Summary

A "Create a new trip" button on My Trips and a form behind it, so a signed-in
traveller can start a trip from scratch. Before this, trips could only be created
from a story's itinerary, so a traveller with no trips saw no way to begin. It
builds on [travel-planner-core.md](travel-planner-core.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/my-trips/new` | `/chuyen-di-cua-toi/moi` | `/en/my-trips/new` |

## Data

- Calls the existing `POST /api/planner` with `source: "blank"` (`tripBlankCreateSchema`): `title`, `destinationSlug`, `durationDays`, `startDate`, `partySize`, `travelStyle`, `pace`, `budget.targetTotalVnd`, `note`. No API or schema change.
- Destinations come from `src/content/destinations.ts`.
- Messages: new `newTrip` namespace and `myTrips.createCta`, in both `messages/vi.json` and `messages/en.json`.

## How it works

1. `MyTrips` shows a link button to `/my-trips/new` above the tabs, in every state (including the empty one).
2. `NewTripForm` (client) validates title (3–120), destination, days (1–30), party (1–50) and budget (whole, ≥ 0) before sending, then posts the strict body.
3. On success it opens the new trip at `/my-trips/[id]`, where the days already exist. On 401 it goes to sign-in; on 422 or other errors it shows a message and keeps the entered values.
4. The page is `noindex`, like the other private Planner pages.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/my-trips/new/page.tsx` | Route, metadata, header |
| `src/components/planner/new-trip-form.tsx` | The form |
| `src/components/planner/my-trips.tsx` | The create button |
| `src/i18n/routing.ts` | `/my-trips/new` pathname |
| `messages/vi.json`, `messages/en.json` | `newTrip`, `myTrips.createCta` |

## Tests

No new automated test: the form is a client component and no DOM test runner is installed. `tests/i18n.test.ts` checks key parity and `tests/routing.test.ts` the routing map. Not tested: the submit flow in a browser.

## Limits and open questions

- The trip detail page is read-only today, so activities cannot yet be added in the browser after creating; that editor is still absent (rule 6).
- The draft is not kept in `sessionStorage` (unlike trip setup), so a redirect to sign-in loses the input.
