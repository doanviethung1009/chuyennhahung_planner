# Feature — Header account

🇻🇳 Bản tiếng Việt: [header-account.vi.md](header-account.vi.md)

## Summary

Every page's header now has a way to sign in and shows who is signed in. A guest
sees a person icon ("Sign in") that opens the sign-in page and returns them to the
page they were reading. A signed-in traveller sees their initial in a round avatar;
it opens a short menu with My Trips, change password, the admin page (admins
only) and sign out. On phones the same entries sit in the menu drawer, with the
label written out in full.

## Routes

None. The control links to existing routes:

| Internal | Vietnamese | English |
|---|---|---|
| `/sign-in` | `/dang-nhap?returnTo=…` | `/en/sign-in?returnTo=…` |
| `/my-trips` | `/chuyen-di-cua-toi` | `/en/my-trips` |
| `/account/password` | `/doi-mat-khau` | `/en/account/password` |
| `/admin` | `/quan-tri` | `/en/admin` |

## Data

- `GET /api/planner/session` → `{ user, expiresAt, passwordChangeRequired }`
  ([ADR 0004](../adr/0004-planner-identity.md)). The header reads
  `user.displayName`, `user.role` and `user.hasPassword`; a `401` means guest.
  The `user` object is deliberately minimal — `displayName`, `role`, `hasPassword`,
  `hasGoogle` — with no id, handle, email or timestamps.
- `DELETE /api/planner/session` signs out (`204`, idempotent).
- Messages under `nav`: `signIn`, `accountMenu`, `signedInAs`, `changePassword`,
  `admin`, `signOut`, `signingOut`, `signOutFailed` (and the existing `myTrips`).

## How it works

- **Client fetch, not a server read.** `useAccount()` in `account-menu.tsx` calls
  `GET /api/planner/session` once the page has loaded. Reading the `HttpOnly`
  cookie in the layout instead would make every page of the site dynamic and
  uncacheable for a control the first paint does not need. Until the answer
  arrives the control renders nothing, so a member never sees "Sign in" flash.
  Plain `fetch`, not the Planner `api()` helper, so a failure only reads as guest
  and never redirects.
- **Guest.** A 44px icon link to the localized sign-in page with
  `returnTo` = the current path and query. Its accessible name and tooltip are
  "Đăng nhập" / "Sign in". It is icon-only on desktop because the header row is
  capped at `max-w-7xl` and the six inline nav entries already fill it; a text label
  wraps them onto two lines.
- **Signed in.** A 44px avatar button (`aria-expanded`, `aria-controls`, accessible
  name "Account for {name}") discloses a panel: "Signed in as {name}", My Trips,
  Account and security (always shown; it opens `/account/password`, whose page title is "Change password"; an account without a password sees an
  explanation and the Google link on that page), Admin (any role except `member` — editor, admin, super admin; the page still checks the role on
  the server) and Sign out. It is a disclosure, not an ARIA `menu`: entries stay
  ordinary links, Tab works as usual, ↓/↑ move between entries, Escape closes and
  returns focus to the button, a click or focus outside closes it.
- **Mobile.** The inline header row only fits from `xl` (1280px), so below that
  the drawer in `main-nav.tsx` replaces it (the inline row omits "Home" — the
  logo goes there — and the drawer keeps it). The drawer shows a full-width "Đăng nhập" button
  for a guest, or the name and the same entries for a member. While open it is a
  modal dialog: focus moves into it, `main`, `footer` and the skip link are
  `inert`, Tab loops between the menu toggle and the panel, Escape closes it, and
  growing the viewport to the desktop layout closes it and releases the scroll lock.
- **Loading.** Until the session is known the header holds an invisible 44px slot
  where the icon or avatar will appear, so nothing shifts when it arrives.
- **Sign out** sends `DELETE /api/planner/session` (same origin, so the route's
  same-origin check passes) and then does a full navigation to the home page so
  every client island re-reads the session. A failure shows an inline alert.
- **`returnTo`.** `safeReturnTo` (`src/lib/return-to.ts`) used to accept only the
  private routes; it now accepts every localized page in the route table except
  `/sign-in` and `/shared/[token]`, so a reader goes back to the story they were
  on. A public page comes back as its path alone — its query and fragment are
  dropped, because `returnTo` is copied into sign-in URLs, logs, `Referer` and the
  stored Google attempt; private pages keep theirs. The open-redirect checks (single leading `/`, no `//`, backslash, control
  character or scheme, known route only) are unchanged. The Google start route
  uses the same guard, so Google returns to the same page.
- **Google.** On the sign-in page the "Sign in with Google" button exists only
  when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
  ([ADR 0007](../adr/0007-password-and-google-sign-in.md)); without them it is not
  rendered at all, so there is no dead button. With Google on, the visitor clicks
  the header icon → sign-in page → "Sign in with Google" → Google's account picker
  → back on the page they started from, now with their avatar in the header. The
  first Google sign-in creates a member account.

## Files

| Path | Role |
|---|---|
| `src/components/layout/account-menu.tsx` | `useAccount`, `AccountMenu` (desktop), `AccountDrawerSection` (mobile), sign out |
| `src/components/layout/main-nav.tsx` | Mounts both, sharing one session read |
| `src/lib/return-to.ts` | `returnTo` allow-list, now every page but sign-in and share links |
| `messages/vi.json`, `messages/en.json` | `nav.*` labels |

## Tests

- [`header-account.test.ts`](../../tests/header-account.test.ts) — the layout,
  header, nav and account menu read no request data (`next/headers`, `cookies()`,
  `@/server/**`), so pages stay static; the menu reads the session endpoint and
  signs out with a same-origin `DELETE`; the admin entry is gated on the admin
  role; the control is mounted on desktop and in the drawer; no `href="#"`.
- [`return-to.test.ts`](../../tests/return-to.test.ts) — public pages (home in both
  locales, stories, destinations, reviews, about) are accepted, with their query
  and fragment dropped; private pages keep theirs; sign-in and share links still
  fall back.
- `i18n.test.ts` keeps the new `nav` keys in both catalogues; `client-boundary.test.ts`
  checks the new client module imports no server code.
- The rendered behaviour (desktop menu by keyboard, mobile drawer at 375px,
  sign-out) was checked by hand in the browser; there is no DOM test runner.

## Limits and open questions

- Every guest page view makes one `GET /api/planner/session`, which answers `401`;
  browsers log that as a console error. A `200 { user: null }` variant, or a
  non-secret "signed in" hint cookie, would remove both — a backend change.
- Each request reads the Planner store; behind heavy traffic this is one store
  read per page view.
- Desktop shows an icon, not the words "Đăng nhập", for lack of room. Shortening a
  nav label or moving one entry to the footer would make room for the text.
- The control appears after the session answer, so it pops in a moment after the
  rest of the header.
