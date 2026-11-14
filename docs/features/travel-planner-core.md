# Feature — Travel Planner core

🇻🇳 Bản tiếng Việt: [travel-planner-core.vi.md](travel-planner-core.vi.md)

## Summary

Lets a traveller plan a real trip and keep it: a trip with one day per day of
travel, activities drawn from the place catalog or invented on the spot, a target
budget measured against what the plan costs and what has actually been paid, and
a clone of an approved itinerary template as a starting point. It serves the
person going on the trip, not the editor — every trip belongs to one traveller
and nobody else can see it, including the site's own admin token.

This is the backend phase that [`CLAUDE.md`](../../CLAUDE.md) rule 6 held back
until the owner opened it, decided in
[ADR 0002](../adr/0002-planner-core.md). There is no Planner UI yet; this ships
the API and the domain rules underneath it.

## Routes

The core is an API surface. The pages built on it live in other feature
documents; the two that belong to sign-in are `/sign-in` (`/dang-nhap`) and,
since [ADR 0007](../adr/0007-password-and-google-sign-in.md), the
change-password page `/account/password` (`/doi-mat-khau`).

Sign-in — no credential needed to call it; it is how you get one
([ADR 0004](../adr/0004-planner-identity.md), [ADR 0007](../adr/0007-password-and-google-sign-in.md)).

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/planner/session` | Body `{ accessToken }` or `{ email, password }`; sets an `HttpOnly` session cookie and says whether a temporary password must be changed |
| `DELETE` | `/api/planner/session` | Signs out: deletes the session row and clears the cookie |
| `GET` | `/api/planner/oauth/google/start` | Starts Google sign-in: records a one-use attempt, sets the `state` cookie, redirects to Google. With `intent=link` and a session it starts linking Google to that account instead. 404 when Google is not configured |
| `GET` | `/api/planner/oauth/google/callback` | Google's redirect back: checks `state`, exchanges the code with PKCE, verifies the `id_token`, then matches the account by `sub`, creates one, or — for an `intent=link` attempt — links Google to the signed-in user who started it. Every outcome is a 302 |
| `POST` | `/api/planner/password` | Changes the signed-in user's password; ends their other sessions |

Operator endpoints added by ADR 0007 (bearer `ADMIN_API_TOKEN`):
`POST /api/admin/planner/users` accepts an optional `email` and then also
returns a one-time `temporaryPassword`;
`POST /api/admin/planner/users/:userId/reset-password` issues a new one and ends
every session; `DELETE /api/admin/planner/users/:userId/google` removes the
Google link.

Traveller endpoints — authenticated by that **session cookie**, or by
`Authorization: Bearer <planner access token>` for curl, scripts and tests. The
owner comes from the credential, never from the payload or the query string.

Every **mutating** request must also state a same-origin `Origin` or
`Sec-Fetch-Site`, and a cookie-authenticated one must state one at all —
otherwise `403 forbidden`. That is the cost of cookies being sent automatically;
see *How it works*. A session opened with an operator-issued temporary password
gets `403 password_change_required` from every route except "who am I",
sign-out and the password change.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/planner` | The caller's trips. Active only, unless `?status=archived` |
| `POST` | `/api/planner` | Creates a trip and its days. `source: "blank"` or `source: "template"` |
| `GET` | `/api/planner/:id` | The whole trip: days with activities, expenses, budget |
| `PATCH` | `/api/planner/:id` | Title, dates, duration, party size, budget, style, pace, note |
| `DELETE` | `/api/planner/:id` | Archives it. `?purge=true` erases an already-archived trip |
| `POST` | `/api/planner/:id/restore` | Brings an archived trip back |
| `GET` | `/api/planner/:id/budget` | The budget summary on its own |
| `PATCH` | `/api/planner/:id/days/:dayNumber` | Titles and notes a day |
| `POST` | `/api/planner/:id/activities` | Adds an activity to a day |
| `PATCH` | `/api/planner/:id/activities/:activityId` | Edits an activity in place |
| `DELETE` | `/api/planner/:id/activities/:activityId` | Removes an activity |
| `PATCH` | `/api/planner/:id/reorder` | `op: "reorder-day"` or `op: "move-activity"` |
| `POST` | `/api/planner/:id/expenses` | Records money paid |
| `PATCH` | `/api/planner/:id/expenses/:expenseId` | Edits an expense |
| `DELETE` | `/api/planner/:id/expenses/:expenseId` | Removes an expense |

Operator endpoints — `Authorization: Bearer <ADMIN_API_TOKEN>`. These provision
travellers and **cannot read or edit any trip**.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/admin/planner/users` | Lists travellers. Never returns a token digest |
| `POST` | `/api/admin/planner/users` | Creates a traveller, returns their token **once** |
| `POST` | `/api/admin/planner/users/:userId/rotate-token` | Issues a new token, kills the old one |
| `DELETE` | `/api/admin/planner/users/:userId` | Removes a traveller who owns no trips |
| `GET` | `/api/admin/planner/integrity` | Referential and structural sweep. Reports identifiers only, never trip content |

Error codes follow the Travel Content System's envelope
([travel-content-api.md](../travel-content-api.md)), plus two added for this
feature: `precondition_required` (428) and `version_conflict` (412).

## Data

Four collections in `.data/planner.json` (override with `PLANNER_STORE`), kept
separate from the content store, plus a fifth for owners. Shapes and validators
are in [`schemas.ts`](../../src/server/planner/schemas.ts) — every type is
`z.infer`-ed from the schema that validates it.

| Collection | Becomes | Key fields |
|---|---|---|
| `users` | `planner_users` | `handle`, `displayName`, `tokenHash` (SHA-256, never returned); since ADR 0007, optional `email`, `passwordHash` (scrypt, never returned), `mustChangePassword`, `googleSub` (never returned), `createdVia` |
| `sessions` | `planner_sessions` | `userId`, `tokenHash` (SHA-256 of the opaque cookie value), `createdAt`, `lastSeenAt`, `expiresAt`, `method` (`token` / `password` / `google`) |
| `oauthAttempts` | `oauth_attempts` | `stateHash`, `nonce`, `codeVerifier`, `returnTo`, `locale`, `expiresAt` — a ten-minute, one-use Google sign-in in flight |
| `trips` | `trips` | `ownerId`, `destinationSlug`, `startDate`, `durationDays`, `partySize`, `budget.targetTotalVnd`, `status`, `sourceTemplate`, `version` |
| `tripDays` | `trip_days` | `tripId`, `dayNumber` (1..n), `date` (derived), `title`, `note` |
| `tripActivities` | `trip_activities` | `tripId`, `dayId`, `order` (0..m), `placeSlug`, `title`, `estimatedCostVnd`, `costScope`, `category` |
| `tripExpenses` | `trip_expenses` | `tripId`, `dayId`, `activityId`, `amountVnd`, `costScope`, `category`, `paidOn` |

References to existing entities are by slug and are checked on write:
`destinationSlug` → [`destinations.ts`](../../src/content/destinations.ts),
`placeSlug` → the Travel Content System's places, `templateSlug` → a **public**
`TravelTemplate`.

A catalog place added with `POST /api/planner/:id/activities` must belong to the
trip's `destinationSlug`; a place from another destination is refused with `422
invalid_reference` (`path: placeSlug`). The rule applies **on create only**: the
place never changes afterwards (the update schema has no `placeSlug`), and template
clones and `planner-import` copy rows that already exist, so existing trips stay
importable and editable. `validateIntegrity` does not flag a mismatch either.

Fields that carry real weight:

- **`costScope`** (`group` | `per_person`) is the most error-prone value in trip
  budgeting — "500k for dinner" means something different for two people than per
  head — so it is explicit on every money row and never inferred.
- **`activityId` on an expense** is what links a payment to the thing it paid
  for, and therefore what stops an activity and its expense being counted twice.
- **`version`** is the optimistic-lock counter for the whole trip.
- **`tokenHash`** must never appear in a response — on a user *or* a session. A
  test asserts that, and a second asserts the session's cookie value never
  appears in the store or in a response body either.
- **`expiresAt` and `lastSeenAt`** are the two axes a session dies on: 14 days
  absolute, 7 days idle. `SESSION_ABSOLUTE_DAYS` and `SESSION_IDLE_DAYS` are
  single constants, because the owner left the exact numbers open.
- **`email` is personal data**, and since Google sign-in creates accounts it is
  customers' as well as staff's. A user response carries `email` and the
  derived `hasPassword` / `hasGoogle`, never `passwordHash` or `googleSub`; the
  integrity sweep reports a shared email by user id, never by value.

Money is integer đồng everywhere, capped at 10^12 by the content system's
`vndSchema`. Nothing here needs the owner's real data; the one operational
prerequisite is a real `ADMIN_API_TOKEN`.

## How it works

Server only — route handlers and a repository, no client code and no component.

A request enters through
[`plannerRoute`](../../src/server/planner/http.ts), which resolves the process-wide
repository, turns the request's credential into a `PlannerIdentity`, enforces the
same-origin rule, and maps any thrown `ContentError` to its status. All three
happen there rather than in the handlers, so no individual route can forget any
of them. The handler receives the owner's id and passes it into every repository
call.

**Two credentials, one identity.** `identify()` tries the session cookie first
and falls back to `Authorization: Bearer` — the single `resolveIdentity` seam
ADR 0004 is built around. A browser signs in once at
`POST /api/planner/session`, which exchanges the operator-issued access token for
an opaque cookie token whose *digest* is stored, exactly as `tokenHash` works for
users. The access token remains the root credential: the cookie is a revocable,
expiring handle on it. A session dies at 14 days absolute or 7 days idle,
whichever comes first, and is swept when it is next touched or on the next
sign-in. `lastSeenAt` is written at most hourly, because updating it on every
request would make each read a store write and serialise the API behind it.
Rotating a user's token deletes that user's sessions, which makes
`rotate-token` the "sign me out everywhere" control. A *stale* cookie falls
through to the bearer path so a script is not broken by a leftover cookie; an
*expired* one says so, because it resolved and a reason is more useful than
silence.

**Passwords (ADR 0007).** An operator who creates a user with an email gets a
temporary password back, once; only its scrypt hash (`N=2^17, r=8, p=1`,
parameters stored in the hash) is kept. Signing in with it opens a `password`
session that `plannerRoute` holds behind `password_change_required` until the
user changes it. Unknown email, no password and wrong password answer the same
401, and an unknown email still runs scrypt against a dummy hash so the timing
matches. scrypt runs outside the store's write queue; the transaction then
re-checks that the verified hash is still the stored one. A per-email limiter
(5 per 15 minutes) sits beside the per-IP one; it slows, never locks.

**Google (ADR 0007).** Hand-written OpenID Connect with PKCE: `start` stores the
`nonce` and verifier under the digest of a random `state`, which also goes into
an `HttpOnly` cookie scoped to `/api/planner/oauth`; `callback` consumes the
attempt before anything else, requires the query `state` to equal the cookie,
exchanges the code server to server, and verifies the `id_token` signature
against Google's cached JWKS plus `iss`, `aud`, `exp`, `iat`, `nonce` and
`email_verified`. The account is matched by `googleSub`; an email that already
belongs to an account is refused with `link_required` and **never linked** — an
operator-typed address was never verified; otherwise — unless
`GOOGLE_SIGNUP_ENABLED=false` or a signup limiter (3 an hour per IP, 30 an hour
overall) says no — it is created with `createdVia: 'google'` and no password, all
in one transaction. Linking is explicit: a signed-in user follows "Link your
Google account" on the change-password page (`start?intent=link`), and the
callback links only while the browser is still signed in as that user and the
Google `sub` is nobody else's. At most 500 Google attempts are in flight at once,
whoever claims to send them.

**CSRF is the price of the cookie.** A bearer token is only ever attached
deliberately; a cookie is attached by the browser to any request to our origin,
including one another site caused. So every mutating request is refused with 403
if it states a cross-site origin, and a cookie-authenticated one is refused if it
states no origin at all — a browser always does on a non-GET. Sign-in is covered
by the same rule, since a cross-site POST there could otherwise hand a victim's
browser a session belonging to the attacker. `SameSite=Lax` is a second line, not
this one: it is browser behaviour, and the server does not assume the client
enforces it.

[`PlannerRepository`](../../src/server/planner/repository.ts) owns all the rules.
Reads and writes go through `requireOwnedTrip`, which throws **404 for another
traveller's trip** — the same stance `getPublishedStory` takes on an unpublished
story, so the API never confirms an id exists to someone who may not see it.
Writes run inside `transaction`, a serialised read-modify-write over the store;
a throw anywhere inside abandons the whole change, so a failed validation cannot
leave half an activity behind.

Day numbers and activity orders are never trusted from the client. Creating a
trip generates days 1..n from `durationDays` and dates them from `startDate`;
changing either re-dates or adds days, and shortening a trip over a day that
still holds an activity or an expense is refused rather than silently destructive.
Reordering requires a permutation of that day's ids; moving an activity renumbers
both days and drags any linked expense along with it, so day totals stay truthful.

The budget is computed on every read by
[`budget.ts`](../../src/server/planner/budget.ts) and never stored — a derived
total that can be saved is a derived total that can be wrong. Three figures are
kept apart: the target, the plan (`estimatedTotalVnd`, activities only) and the
money paid (`actualTotalVnd`, expenses only). The first two are never summed.
`projectedTotalVnd` is the one figure that mixes them, and it skips any activity
that already has an expense, so 310.000₫ paid against a 250.000₫ plan projects
310.000₫ rather than 560.000₫. A `per_person` amount is multiplied by the party
size exactly once, on its way into a total.

Cloning reads an approved template through
[`PlannerCatalog`](../../src/server/planner/catalog.ts) — a read-only interface
with three lookups and no writer — and writes entirely new rows. The template
cannot be modified because the dependency has no way to modify it.

Concurrency: a trip response carries `ETag: "<version>"`. Mutations of existing
state require it back as `If-Match` and answer **428** without it, **412** when it
is stale. Appends treat it as optional but verify it when sent.

Error and empty paths: an unknown trip, day, activity or expense is a 404; a
reference that does not resolve is a 422 with the field path; an archived trip is
readable and restorable but answers 409 to an edit; `DELETE` never destroys on
the first request.

[`money.ts`](../../src/server/planner/money.ts) is the boundary for the day a SQL
driver arrives: `normalizeVnd` accepts `number | bigint | string` and refuses
anything a double cannot hold exactly, and `jsonSafe` runs over every response so
a raw `bigint` can neither throw nor silently become a string.

## Files

| Path | Role |
|---|---|
| [`src/server/persistence/json-store.ts`](../../src/server/persistence/json-store.ts) | Generic document store — atomic write, in-process write queue. Shared with the content store |
| [`src/server/planner/schemas.ts`](../../src/server/planner/schemas.ts) | Validators and the types inferred from them |
| [`src/server/planner/store.ts`](../../src/server/planner/store.ts) | `PlannerData` and its memory/JSON-file stores |
| [`src/server/planner/auth.ts`](../../src/server/planner/auth.ts) | Token and session issue, hashing, cookie parsing, constant-time resolution to an owner |
| [`src/server/planner/catalog.ts`](../../src/server/planner/catalog.ts) | Read-only window onto destinations, places and approved templates |
| [`src/server/planner/budget.ts`](../../src/server/planner/budget.ts) | Budget computation — pure functions over rows |
| [`src/server/planner/money.ts`](../../src/server/planner/money.ts) | Integer-đồng rules and the BigInt/JSON boundary |
| [`src/server/planner/repository.ts`](../../src/server/planner/repository.ts) | All domain logic and every invariant |
| [`src/server/planner/http.ts`](../../src/server/planner/http.ts) | Route wrappers, `ETag`/`If-Match`, response envelope |
| [`src/server/planner/instance.ts`](../../src/server/planner/instance.ts) | The process-wide repository |
| [`src/app/api/planner/**`](../../src/app/api/planner) | Traveller route handlers |
| [`src/app/api/planner/session/route.ts`](../../src/app/api/planner/session/route.ts) | Sign-in (token or password) and sign-out |
| [`src/server/planner/password.ts`](../../src/server/planner/password.ts) | scrypt hashing, verification, dummy hash, temporary passwords |
| [`src/server/planner/google.ts`](../../src/server/planner/google.ts) | Google configuration, authorize URL, code exchange, JWKS cache, `id_token` verification |
| [`src/server/planner/google-http.ts`](../../src/server/planner/google-http.ts) | The `state` cookie and the redirects of the two Google routes |
| [`src/app/api/planner/oauth/google/**`](../../src/app/api/planner/oauth/google) | Google `start` and `callback` |
| [`src/app/api/planner/password/route.ts`](../../src/app/api/planner/password/route.ts) | Change password |
| [`src/app/api/admin/planner/users/**`](../../src/app/api/admin/planner/users) | Operator route handlers — provisioning |
| [`src/app/api/admin/planner/integrity/route.ts`](../../src/app/api/admin/planner/integrity/route.ts) | Operator route handler — the integrity sweep |

`src/server/content/errors.ts` gained two HTTP-generic codes
(`precondition_required`, `version_conflict`), and `src/server/content/store.ts`
became a thin wrapper over the shared document store with its exported
signatures unchanged.

## Tests

163 tests across nine files, all green (the two ADR 0007 files add 48).

| File | What it actually asserts |
|---|---|
| [`planner-repository.test.ts`](../../tests/planner-repository.test.ts) | Day generation and dating; catalog vs self-made activities and the inferred title/category; insert position; reorder permutation rules; cross-day moves carrying a linked expense; archive/restore/purge; growing a trip and the refusal to shorten over a non-empty day; expense/day/activity reference rules; token rotation invalidating the old token; and cross-owner access answering `not_found` on every verb while leaving the owner's trip untouched |
| [`planner-budget.test.ts`](../../tests/planner-budget.test.ts) | `per_person` scaled once and re-scaled when the party changes; estimate and actual never summed; a settled activity dropped from the projection; a 0₫ expense still settling; by-category, by-day and trip-level splits; and the money boundary — `bigint`, digit-string and number inputs, refusal of values a double cannot hold exactly, `jsonSafe` over a nested `bigint`, and overflow-checked arithmetic |
| [`planner-acceptance.test.ts`](../../tests/planner-acceptance.test.ts) | The demo scenario end to end (Đà Lạt, 3 ngày 2 đêm, 2 người, 5.000.000₫, lãng mạn); cloning the **real seeded** `da-lat-3-ngay-lang-man` template; proof the template is byte-identical after the clone is moved, deleted from and repriced; and a reload through a real JSON file where a fresh repository sees every row |
| [`planner-api.test.ts`](../../tests/planner-api.test.ts) | The real route handlers: 401 paths, the admin token explicitly unable to read any trip, 422 with field paths, the full activity→reorder→expense→budget flow, 428 without `If-Match`, 412 on a stale version, 400 on a malformed one, 404 isolation per verb, the archive/restore/purge sequence, and the sweep being operator-only |
| [`planner-session.test.ts`](../../tests/planner-session.test.ts) | The session layer at domain level: sign-in and the identity it produces, only the digest stored and the cookie value absent from the store, a separate session per sign-in so a second device is independent, an absolute expiry that using the session does not extend, idle expiry inside the absolute window, the throttled `lastSeenAt` write, idempotent sign-out, rotation and user deletion killing sessions while leaving another traveller's alone, a stale cookie falling through to the bearer token, an expired one reporting itself, other cookies on the request ignored, and the four session integrity checks |
| [`planner-session-api.test.ts`](../../tests/planner-session-api.test.ts) | The HTTP half: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` and `Max-Age` on the cookie, the token absent from the response body, sign-out clearing it with `Max-Age=0`, 401 setting no cookie, and the same-origin rule — a cookie mutation with no origin refused, cross-site `Origin` and `Sec-Fetch-Site` refused with nothing applied, both same-origin forms allowed, the bearer path still working without an origin but still refused cross-site, and a cross-site sign-in refused |
| [`planner-password.test.ts`](../../tests/planner-password.test.ts) | scrypt round-trip, per-hash salt, stored parameters, upgrade of a weak hash, malformed and memory-hungry hashes refused; temporary password only with an email; duplicate email refused without echoing it; the same 401 for unknown email, no password and wrong password; the change gate, change keeping this session and ending others, reset ending all; the credential integrity checks; and over HTTP the 403 gate, a cross-site change refused, a short password 422, the per-account limiter at the sixth guess from six addresses, and the operator reset |
| [`planner-google.test.ts`](../../tests/planner-google.test.ts) | Configuration off unless both secrets are set; the RFC 7636 PKCE vector; `id_token` accepted, keys cached, and refused for another key, an unknown `kid`, wrong `iss`/`aud`/`nonce`, expiry, future `iat`, no `sub`, unverified email, `alg: none` and garbage; account creation, reuse, `link_required` for an email match with nothing changed, explicit linking and its two conflicts, the 500-attempt ceiling, conflict, signup closed or throttled, a race creating one account, handle collisions; one-use `state`; and over HTTP against a fake Google: 404 when unconfigured, the authorize redirect and cookie, a new customer signed in and returned, an email match sent back with `link_required`, a signed-in user linking and then signing in with Google, linking refused without a session or from another one, a forged and a replayed `state`, cancelled and unverified codes, signup off, and an off-site `returnTo` ignored |
| [`planner-integrity.test.ts`](../../tests/planner-integrity.test.ts) | One broken invariant per test, applied by writing straight to the store so the repository is bypassed exactly as a hand edit would bypass it: unknown owner and destination, a wrong `endDate`, archived/`archivedAt` disagreement, a missing day and a numbering gap, a day dated off the trip calendar, an order gap and a duplicated order, a withdrawn place, rows homed to another trip, orphans in all three child collections, an expense whose day contradicts its activity, duplicate ids and handles, a malformed token digest — plus a test asserting the sweep leaks no title, label, note or amount, and one asserting an edited or withdrawn template is reported as staleness rather than damage |

Deliberately untested: multi-process write contention — the JSON store cannot
survive it and the tests would be asserting a known limitation rather than a
behaviour — and the real Google endpoints: the tests run against a fake Google
with a locally generated RSA key, so a change on Google's side is caught only by
signing in for real.

## Limits and open questions

- **Single-process persistence**, inherited from
  [ADR 0001](../adr/0001-travel-content-system.md) §1. The write queue serialises
  within one Node process and cannot across two, so the optimistic concurrency
  here protects against two *users* racing, not two *instances*. Multi-instance
  deployment is the trigger to pick SQL — the shape is already written down in
  [ADR 0002](../adr/0002-planner-core.md#the-sql-shape-this-becomes), including
  the indexes.
- **Identity is self-managed, not an identity provider.** Sessions
  ([ADR 0004](../adr/0004-planner-identity.md)), passwords and Google sign-in
  ([ADR 0007](../adr/0007-password-and-google-sign-in.md)) exist; there is no
  self-service password reset (no email sender), no password signup and no MFA.
  Open signup through Google means anyone with a Google account can add a row
  to a single JSON document; `GOOGLE_SIGNUP_ENABLED=false` closes it.
- **Owner input still needed before signup is on in production:** a privacy
  notice for customers who sign up with Google and a way to ask for an account
  to be deleted (Vietnam's Decree 13/2023), and the Google OAuth client itself.
- **Rate limiting is per process.** Sign-in (10/min per IP), password guesses
  (5 per 15 minutes per email) and Google signups (3/hour per IP) are counted in
  memory, keyed on a spoofable forwarded address; a multi-instance deployment
  multiplies them. Because that key can be forged, signups also pass a global
  bucket (30/hour), Google attempts have a global ceiling (500 in flight), and
  scrypt — about 128 MB each — runs at most 4 at once with 32 waiting, then
  answers 429.
- **No "your active sessions" view.** A traveller cannot see or revoke one
  device; the only revocation is `rotate-token`, which signs out everywhere.
- **`Secure` follows the request's scheme** so a plain-http dev server works. In
  production the site is https, so the flag is set — but a deployment that
  terminated TLS and forwarded http without telling Next would silently drop it.
- **The integrity sweep detects, it does not repair.** `GET
  /api/admin/planner/integrity` names every broken invariant it finds, and fixing
  one is still a manual edit or a follow-up change. Nothing runs it on a
  schedule either — it is on demand, so a corruption introduced by a hand edit
  sits undetected until somebody asks.
- **No UI.** The Planner page at `/thiet-ke-chuyen-di` is still the contact-only
  content page described in [plan-your-trip.md](plan-your-trip.md). Wiring it up
  is frontend-owned work and has not started.
- **Deliberately out of scope this round**, per the brief: map integration and AI
  suggestions.
- **`destinationSlug` is immutable** once a trip exists. Activities hang off
  places in that destination, so moving a trip elsewhere is a new trip, not an
  edit. If travellers ask to "move" a trip, that is a product decision, not a bug.
- **Open question: retention.** Archived trips are kept indefinitely. Nobody has
  said how long traveller data should be held, so nothing expires it.
- **Open question: sharing.** A trip is visible to exactly one traveller. Shared
  or collaborative trips would need a membership table and a second look at every
  authorization check in the repository.
