# Feature — Error and loading states

🇻🇳 Bản tiếng Việt: [error-loading-states.vi.md](error-loading-states.vi.md)

## Summary

A shared baseline for what a visitor sees when a public page is slow, empty or
broken (UXS-1 of the UI/UX master audit, findings UXA-03, UXA-07 and the error
parts of UXA-08 and UXA-12). Before it, a thrown error showed the framework's
unbranded page, a slow page was blank until the server finished, an environment
with no story rendered an empty home page, and "the store could not be read" was
worded as "nothing here yet".

## Routes

None. No route is added or changed (CLAUDE.md rule 2 is untouched).

## Data

Message namespace `states` (`loading`, `errorTitle`, `errorBody`, `retry`,
`backHome`) plus `home.empty.*`, `stories.errorTitle/errorBody`,
`community.errorTitle/errorBody` and `tripDetail.errorTitle/retry`, in both
catalogues. No content or Planner data changes.

## How it works

- `src/app/[locale]/error.tsx` is the boundary for every public page. It renders
  inside the locale layout (header, footer and message provider stay) and replaces
  only the page: one `<h1>`, `role="alert"`, a **Try again** button (`reset`) and a
  link home. The error text is never shown; the log gets the digest or the error
  class only.
- `src/app/global-error.tsx` is the last resort when the root layout itself fails.
  It has no provider, so it reads the words from the two catalogue files directly
  and takes the language from the URL (`/en…` is English, anything else Vietnamese).
- `PageSkeleton` (`src/components/ui/page-skeleton.tsx`) is the loading skeleton: an
  `aria-hidden` block, **no heading** (the page that replaces it brings its single
  `<h1>`), one `role="status"` line, pulsing only under `motion-safe`. It is wired
  through a `loading.tsx` on **leaf routes only**: `/trip-templates`,
  `/community-trips`, `/reviews` and `/my-trips`. A `loading.tsx` makes Next send the
  status line before the page runs, so above a route that calls `notFound()` every
  unknown slug or token would answer 200 instead of 404. A first version at the locale
  root did exactly that (the e2e smoke caught it); `tests/loading-boundary-guard.test.ts`
  now forbids it.
- `StateNotice` (`src/components/ui/state-notice.tsx`) is the one panel for empty
  and error states: an error carries `role="alert"`, an empty state does not.
- The home page with no published story renders `HomeEmpty` (an `<h1>` and links to
  the templates and to a new trip) instead of nothing.
- `/stories` and `/community-trips` show an error panel with a retry link when the
  read fails. For the gallery this needed `loadCommunityTrips`, which reports
  `{ ok: false }`; `getCommunityTrips` still returns `[]` on failure, so the home
  section keeps hiding itself exactly as before.
- The trip detail page now has a different heading for a failed read than for a
  missing trip, and a **Try again** button for the failure only.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/error.tsx` | Public error boundary |
| `src/app/global-error.tsx` | Root-layout failure |
| `src/components/ui/page-skeleton.tsx`, `src/app/[locale]/{trip-templates,community-trips,reviews,my-trips}/loading.tsx` | Loading skeleton on leaf routes |
| `src/components/ui/state-notice.tsx` | Empty/error panel |
| `src/components/home/home-empty.tsx` | Home page with no story |
| `src/app/[locale]/stories/page.tsx`, `community-trips/page.tsx` | Error panel on failed reads |
| `src/server/community/public.ts` | `loadCommunityTrips` |
| `src/components/planner/trip-detail.tsx` | Error vs missing, retry |
| `messages/vi.json`, `messages/en.json` | New strings |

## Tests

`tests/dom/error-states.test.tsx`: `StateNotice` alert and heading level; the route
boundary (one `<h1>`, alert, reset on click, link home, the error message never
printed, EN copy); the global boundary renders from the catalogue; `TripDetail`
error shows its own heading and retry reads again, a missing trip has no retry.
`tests/loading-boundary-guard.test.ts`: no `loading.tsx` at the locale root or above a dynamic segment.
`tests/community-public-load.test.ts`: failure is `{ ok: false }` for the gallery and
`[]` for the home contract, only the error class is logged. Key parity is covered by
`tests/i18n.test.ts`.
**Not tested:** the real Next.js boundary wiring and the skeleton in a browser
(checked by hand, see below), and the `/stories` failure path (a page, not a
component).

## Limits and open questions

- No skeleton on `/`, `/stories`, `/places`, `/destinations` or `/itineraries`: each
  has a `[slug]` child that must answer 404, so they need an in-page `Suspense`
  instead of `loading.tsx` (not done).
- The skeleton is one generic shape (masthead plus a card grid) for every route.
- No page-level `Suspense`: a slow page still waits for its slowest read before
  anything of it appears, only the skeleton arrives sooner.
- `/my-trips/[id]` loads on the client and keeps its own loading heading (an `<h1>`
  that is then replaced); that is UXS-5.
- Empty states of community trips and reviews are still a bare line of text (UXS-6).
- `global-error` shows without fonts and header by design.
