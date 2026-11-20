# Feature — Follow Hưng's footsteps

🇻🇳 Bản tiếng Việt: [follow-hung-footsteps.vi.md](follow-hung-footsteps.vi.md)

## Summary

A reader of the Đà Lạt story sees the itinerary we really followed and can turn
it into a trip of their own: pick dates, party size and budget as an anonymous
visitor, sign in only at the moment of saving, and end up with an independent
copy in My Trips. From there they can set a planning status, duplicate, archive
and share the trip as a read-only link. The original template, the blog, the
tours and the existing sign-in are unaffected. Decision record:
[ADR 0005](../adr/0005-trip-sharing-and-story-cloning.md).

## Routes

| Internal | Vietnamese | English | Indexed |
|---|---|---|---|
| `/trip-setup/[template]` | `/tao-chuyen-di/[template]` | `/en/trip-setup/[template]` | no |
| `/sign-in` | `/dang-nhap` | `/en/sign-in` | no |
| `/my-trips` | `/chuyen-di-cua-toi` | `/en/my-trips` | no |
| `/my-trips/[id]` | `/chuyen-di-cua-toi/[id]` | `/en/my-trips/[id]` | no |
| `/shared/[token]` | `/chia-se/[token]` | `/en/shared/[token]` | `public` only |

The story page `/stories/di-da-lat-lan-thu-sau` gains a "Lịch trình thực tế"
section and a call to action. The "start from a template" button on `/plan-your-trip`
now leads to the template list `/trip-templates` ([trip-template-list.md](trip-template-list.md))
instead of `/stories`. Private pages are `noindex` and are not in
`src/app/sitemap.ts`. `/shared/[token]` has no `hreflang` alternates, so a token
is never advertised across locales.

## Data

- `Story.plannerTemplateSlug` (`src/content/types.ts`) links a story to a public
  Planner template; `di-da-lat-lan-thu-sau` points at `da-lat-3-ngay-lang-man`.
- The template is read server-side with `getRepository().getPublicTemplate(slug)`.
  A missing or withdrawn template renders neither the section nor the CTA.
- `Trip` gains `planningStatus`, `visibility`, `shareToken`, `shareTokenCreatedAt`,
  `duplicatedFromTripId`; `sourceTemplate.story` is filled server-side.
  `SharedTripView` is the allow-listed public projection (no owner, ids, version,
  trip note or expenses). Types live in `src/server/planner/schemas.ts`.
- Message namespaces: `journey`, `tripSetup`, `signIn`, `myTrips`, `tripDetail`,
  `share`, `shared`, `planning`, `visibility`, `travelStyle`, `itineraryDays`, and
  `nav.myTrips`.
- Browser state: the setup draft in `sessionStorage` under `cnh:trip-setup:<template>`
  (form fields only, never a credential). The session is an `HttpOnly` cookie.

## How it works

API used (all same-origin, cookie-authenticated; bodies are `.strict()`):
`POST /api/planner` (`source: 'template'`), `GET /api/planner?status=`,
`PATCH /api/planner/[id]` (`If-Match`, `planningStatus`),
`DELETE /api/planner/[id]` (archive; `?purge=true` on an archived trip),
`POST .../restore`, `POST .../duplicate`, `PUT|DELETE .../share`,
`POST .../share/rotate`, `GET|POST|DELETE /api/planner/session`,
`GET /api/shared/[token]` (public, rate limited).

1. **Story page** (server, ISR 60 s) renders the template days and a link to
   `/trip-setup/[template]`.
2. **Trip setup** (server page, client form `TripSetupForm`) edits title, date,
   party size, budget, style, pace and note. Every change is written to the
   `sessionStorage` draft. Save posts exactly the contract fields. On `401` the
   draft is kept and the browser goes to `/sign-in?returnTo=<this path>`; on `201`
   the draft is cleared and the traveller lands on `/my-trips/<id>`.
3. **Sign in** (`SignInForm`) posts the operator-issued access code. `returnTo` is
   validated on the server by `safeReturnTo` (`src/lib/return-to.ts`): a single
   leading `/`, no `//`, no backslash or control character, no scheme, and it must
   match a known localized page of the site other than `/sign-in` and
   `/shared/[token]` (see [header account](header-account.md)); otherwise it falls
   back to `/my-trips`.
   `429` shows the retry delay.
4. **My Trips** (`MyTrips`) lists active or archived trips; status change,
   duplicate, archive, restore and a two-step permanent delete. A `401` redirects
   to sign-in with `returnTo`; a `412` refreshes the list. Archiving also revokes
   the share link, so a restored trip comes back private and sharing it again
   mints a new token.
5. **Trip detail** (`TripDetail`) shows the trip read-only plus status, duplicate,
   archive and `SharePanel`: visibility select, link (built client-side from the
   returned token and the active locale), copy, rotate, revoke. The token lives in
   component state only.
6. **Shared page** is a server component, `force-dynamic`. A single cached loader
   applies the share-read rate limit and calls `getSharedTrip`, shared by
   `generateMetadata` and the page. Unknown token: `notFound()`. Rate limited: a
   noindex "try again shortly" state with no trip data. Metadata: `referrer:
   no-referrer`; robots indexable only for `public`. No scripts, embeds or
   analytics, no edit controls, and an attribution link back to the story.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/stories/[slug]/page.tsx` | Real-itinerary section and CTA |
| `src/app/[locale]/trip-setup/[template]/page.tsx` | Setup page, reads the public template |
| `src/app/[locale]/sign-in/page.tsx` | Sign-in page, validates `returnTo` |
| `src/app/[locale]/my-trips/page.tsx`, `my-trips/[id]/page.tsx` | Private shells |
| `src/app/[locale]/shared/[token]/page.tsx` | Public read-only share page |
| `src/components/planner/*` | `api`, `field`, `itinerary-days`, `trip-setup-form`, `sign-in-form`, `my-trips`, `trip-detail`, `share-panel`, `status-select` |
| `src/lib/return-to.ts` | Open-redirect guard |
| `src/content/stories.ts` | `plannerTemplateSlug` on the Đà Lạt story |
| `src/components/layout/site-footer.tsx` | "My trips" footer link |
| `messages/vi.json`, `messages/en.json` | All strings |

## Tests

- `tests/return-to.test.ts`: accepts known routes in both locales; rejects `//evil.com`,
  `https://…`, `/\evil.com`, `javascript:`, control characters, unknown and
  non-returnable paths, null.
- Backend behaviour (share lifecycle, no-oracle 404s, projection leakage,
  authorization, strict bodies, duplicate, rate limiter, session probe) is covered
  by `tests/planner-sharing.test.ts`, `tests/rate-limit.test.ts` and the planner suites.
- `tests/i18n.test.ts`, `tests/routing.test.ts`, `tests/docs.test.ts`,
  `tests/design-tokens.test.ts` cover catalogue parity, the five routes, this
  document and token usage.
- Not covered by automated tests: the client forms and the rendered pages. The
  browser flow (anonymous visit, customise, save, sign in, draft restored, share, open
  the link without a cookie) was checked by hand on 2026-11-10; the EN locale and a
  real private window are still unchecked. Phase 05 closed on 2026-11-16 with
  `/sec-check` PASS_WITH_WARNINGS and `/qc-check` PASS with gaps; follow-ups are
  `P05-7`..`P05-11` in `.claude/roadmap/backlog.md`.

## Limits and open questions

- Sign-in is still the operator-issued access code ([ADR 0004](../adr/0004-planner-identity.md));
  there is no public signup.
- My Trips detail has status, duplicate, archive and share, and the browser trip
  editor ([trip-editor.md](trip-editor.md)) edits days, activities and expenses of an
  active trip; an archived trip stays read-only.
- No public gallery of public trips; `public` only allows indexing of the one page.
- The rate limiter is per-process and trusts `x-forwarded-for` (see ADR 0005).
- The story page is ISR (60 s), so a withdrawn template can linger up to a minute.
- Place names on the shared page come from activity titles; `placeSlug` is not
  resolved to a name.
- The access-code hint and the footer link are the only entry points to My Trips;
  no header nav entry was added.
