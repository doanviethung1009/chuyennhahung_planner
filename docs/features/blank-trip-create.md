# Feature — Start a blank trip

🇻🇳 Bản tiếng Việt: [blank-trip-create.vi.md](blank-trip-create.vi.md)

## Summary

A signed-in or soon-to-be signed-in traveller can start a trip from scratch: pick a
destination and a number of days, and the Planner sets up that many empty, numbered
days. Until now a trip could only be cloned from a story's itinerary. Builds on
[travel-planner-core.md](travel-planner-core.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/new-trip` | `/chuyen-di-moi` | `/en/new-trip` |

The page is `noindex` and not in the sitemap, like the other private Planner pages.

## Data

- Writes through the existing `POST /api/planner` with `source: "blank"` (`tripBlankCreateSchema`); no API or schema change.
- Reads `destinations` from `src/content/destinations.ts` for the destination list — the same source the server validates `destinationSlug` against.
- Messages: new namespace `newTrip` and the key `myTrips.newTrip`, in both `messages/vi.json` and `messages/en.json`.

## How it works

1. The server page renders `BlankTripForm` with the localized destination names.
2. The form validates what the API validates (name 3–120 characters, destination chosen, 1–30 days, 1–50 travellers, whole non-negative budget) and sends exactly the contract fields, because the body is strict.
3. The draft lives in `sessionStorage` under `cnh:new-trip` (form fields only, no credential), is restored after a sign-in round trip, and is cleared on success.
4. A `401` sends the traveller to sign-in (`goToSignIn`) and back; a `422` and any other failure show a message and keep the draft. Success goes to `/my-trips/[id]`.
5. `/my-trips` links here from its header and from the empty state.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/new-trip/page.tsx` | Server page, metadata, destination list |
| `src/components/planner/blank-trip-form.tsx` | The client form |
| `src/components/planner/my-trips.tsx` | "Start a new trip" entry points |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Route and sign-in return allow-list |
| `messages/vi.json`, `messages/en.json` | Strings |

## Tests

No new test file. `tests/routing.test.ts`, `tests/return-to.test.ts` and `tests/i18n.test.ts` cover the route table, the return-to allow-list and VI/EN parity. The form itself has no component test (the repository has no component-test setup); the create contract is covered by the existing planner API tests.

## Limits and open questions

- The new trip is empty: adding days' activities, expenses and reordering still has no editor UI (API only).
- The destination list is the static seed, not the content store.
- The page was not exercised in a browser in this change.
