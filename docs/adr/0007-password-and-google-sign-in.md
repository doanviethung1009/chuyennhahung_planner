# ADR 0007 — Planner sign-in with an email and password, and with Google

🇻🇳 Bản tiếng Việt: [0007-password-and-google-sign-in.vi.md](0007-password-and-google-sign-in.vi.md)

- **Status:** Proposed — awaiting the owner's acceptance. No code is written against it before then.
- **Date:** 2026-11-10
- **Owner:** system-architect
- **Affects:** `src/server/planner/auth.ts`, `src/server/planner/schemas.ts`, `src/server/planner/repository.ts`, `src/server/planner/http.ts`, `src/server/rate-limit.ts`, `src/app/api/planner/session/**`, `src/app/api/planner/oauth/**` (new), `src/app/api/admin/planner/users/**`, `src/components/planner/sign-in-form.tsx`, `src/app/[locale]/sign-in/page.tsx`, `messages/*.json`

## Context

Today a traveller has exactly one credential: the 48-byte access token an
operator issues through `POST /api/admin/planner/users`, returned once
(`PlannerRepository.createUser`, `src/server/planner/repository.ts:286`). The
browser signs in by pasting that 64-character token into `/sign-in`
(`src/components/planner/sign-in-form.tsx`), which `POST /api/planner/session`
exchanges for an `HttpOnly` session cookie (`repository.ts:219`, ADR 0004).
Every request then resolves through one seam, `identify`
(`repository.ts:182`), and every trip method filters by `ownerId`.

That works, and it is not something staff can live with. A token is not
memorable, so it ends up in a note or a chat message; it cannot be typed on a
phone; and losing it means an operator has to rotate it. ADR 0004 §6 kept
passwords, OAuth and MFA out of scope deliberately, and said each needs its own
decision. The owner has now asked for two ways to sign in:

1. **Accounts the owner creates**, signed in with an email and a password.
2. **Google accounts**, signed in with "Sign in with Google".

What is known: the Planner is still for Nhà Hưng's own staff first (ADR 0004
Context); there is no email sender, so nothing can be mailed to a user; there
is no Google OAuth client yet. What is not known: whether customers will ever
self-serve, whether staff use Google Workspace on a company domain or personal
Gmail, and whether `admin` accounts (ADR 0006) will require MFA.

## Decision

1. **Two new credentials, one session.** An email and password, and a Google
   identity, are two more ways to *obtain* the existing ADR 0004 session — the
   same `planner_session` cookie, the same `plannerSessions` row, the same
   14-day absolute and 7-day idle lifetimes, the same CSRF check. `identify`,
   `requireOwnedTrip` and every repository method below them are untouched.
   A successful sign-in by any method always issues a new session.

2. **No public signup; Google never creates an account.** An account exists
   only because an operator created it. Google can sign in to an account that
   already exists; it cannot make one. This is the owner's "staff first" scope,
   and it means a stranger with a Google account gets nothing.

3. **The access token stays.** It remains the credential for scripts, curl and
   tests (`Authorization: Bearer`) and keeps working at
   `POST /api/planner/session`. The sign-in form demotes it to a secondary
   "sign in with an access token" disclosure while existing users have no email,
   and a later change removes it from the form once every user has one.

### Data model

`PlannerUser` gains four **optional** fields, read as `null` when absent, so an
existing `.data/planner.json` loads unchanged (expand, then contract):

| Field | Type | Meaning |
|---|---|---|
| `email` | `string \| null` | Trimmed and lower-cased on write; unique across users. No other normalisation (dots in Gmail addresses are kept). |
| `passwordHash` | `string \| null` | `scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>`. Null means password sign-in is off for this user. |
| `mustChangePassword` | `boolean` | True for an operator-issued temporary password; cleared by the user's first password change. |
| `googleSub` | `string \| null` | Google's stable subject id (`sub`), unique across users. Set the first time the user signs in with Google. |

`publicPlannerUserSchema` keeps omitting every credential: `passwordHash` and
`googleSub` are never returned; `email` is returned to the user themself and to
the operator, and `hasPassword` / `hasGoogle` booleans are derived for display.

A new collection, `oauthAttempts`, holds an in-flight Google sign-in:
`{ id, stateHash, nonce, codeVerifier, returnTo, createdAt, expiresAt }`, with a
10-minute life, swept on write the way expired sessions are.

### Password sign-in

- **Hashing** with `scrypt` from `node:crypto` — no new dependency. Parameters
  start at the OWASP baseline `N=2^17, r=8, p=1`, 16-byte salt, 32-byte output,
  and are stored inside each hash, so they can be raised later and old hashes
  upgraded on the next successful sign-in. Comparison is `timingSafeEqual`.
- **Policy** follows NIST SP 800-63B: at least 12 characters, at most 128, any
  characters, no composition rules, no forced periodic change.
- **Endpoint:** `POST /api/planner/session` accepts either body, discriminated
  by shape: `{ accessToken }` (unchanged) or `{ email, password }`. One endpoint,
  one rate limiter, one cookie writer.
- **No enumeration:** an unknown email, a user with no password and a wrong
  password all answer the same `401 unauthorized` with the same message, and an
  unknown email still runs `scrypt` against a fixed dummy hash so the timing
  matches.
- **Throttling:** the existing per-IP `signInLimiter` (10/min) stays, and a
  second limiter keyed by the normalised email (5 attempts per 15 minutes)
  slows guessing against one account from many addresses. It throttles; it never
  locks an account, so it cannot be used to lock staff out. Both are in-memory
  and per-process (ADR 0005), which is acknowledged, not solved, here.
- **Temporary password:** an operator never chooses a user's password.
  `POST /api/admin/planner/users` accepts an optional `email`; when given, the
  server generates a random temporary password, returns it **once** (like the
  access token) and sets `mustChangePassword`. A session opened with it can only
  call `GET`/`DELETE /api/planner/session` and the change-password endpoint;
  every other Planner route answers `403 password_change_required`.
- **Change:** `POST /api/planner/password` with `{ currentPassword, newPassword }`,
  same-origin enforced. It deletes every *other* session of that user.
- **Reset:** there is no self-service reset (no email sender). An operator calls
  `POST /api/admin/planner/users/:userId/reset-password`, which issues a new
  temporary password and deletes all of that user's sessions — the same "sign
  out everywhere" semantics as `rotate-token`.

### Google sign-in

Hand-written OpenID Connect authorization-code flow with PKCE against Google's
documented endpoints, using `fetch` and `node:crypto` only.

- `GET /api/planner/oauth/google/start?returnTo=…` validates `returnTo` with the
  existing `safeReturnTo` (`src/lib/return-to.ts`), creates an `oauthAttempts`
  row with a random `state`, `nonce` and PKCE `code_verifier`, sets a 10-minute
  `HttpOnly; Secure; SameSite=Lax; Path=/api/planner/oauth` cookie carrying the
  raw `state`, and answers `302` to Google with `scope=openid email`,
  `code_challenge_method=S256`, `prompt=select_account`.
- `GET /api/planner/oauth/google/callback` requires the `state` in the query to
  equal the cookie's and to resolve to an unexpired attempt (the attempt is
  consumed whatever happens next — one use only). It exchanges `code` plus the
  `code_verifier` at Google's token endpoint server-to-server with the client
  secret, then verifies the `id_token`: RS256 signature against Google's JWKS
  (cached per its `Cache-Control`, refetched once on an unknown `kid`), `iss` is
  `https://accounts.google.com` or `accounts.google.com`, `aud` equals the client
  id, `exp` is in the future, `nonce` matches, and `email_verified` is `true`.
  Any failure redirects to the localized `/sign-in` with a coarse error code;
  details go to the server log, never to the page.
- **Matching an account:** first by `googleSub`. If no user has that `sub`, by
  the verified `email` equal to a user's `email` whose `googleSub` is still null —
  and then `sub` is stored, so from then on the link follows Google's stable id,
  not the address. No match is `account_not_found`; nothing is created.
- **Unlinking:** `DELETE /api/admin/planner/users/:userId/google` clears
  `googleSub` and deletes that user's sessions.
- **Configuration:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and the redirect
  URI derived from `NEXT_PUBLIC_SITE_URL` + `/api/planner/oauth/google/callback`.
  Server-only, never `NEXT_PUBLIC_*`, guarded by `tests/client-boundary.test.ts`.
  **Fail closed:** when either variable is missing, both Google routes answer
  `404` and the sign-in page does not render the Google button, so the site runs
  without Google configured.
- The callback is a cross-site top-level `GET`, so it cannot pass the
  same-origin check; the `state` bound to the browser's own cookie is its CSRF
  defence, and it also prevents login CSRF (being signed in to someone else's
  account).

### Flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant S as Planner server
  participant G as Google
  B->>S: POST /api/planner/session {email, password}
  S->>S: scrypt verify, rate limits
  S-->>B: 201 + Set-Cookie planner_session
  B->>S: GET /api/planner/oauth/google/start
  S-->>B: 302 to Google + state cookie
  B->>G: consent (openid email)
  G-->>B: 302 callback?code&state
  B->>S: GET /api/planner/oauth/google/callback
  S->>G: code + code_verifier + secret
  G-->>S: id_token
  S->>S: verify signature, iss, aud, exp, nonce, email_verified; match sub or email
  S-->>B: 302 returnTo + Set-Cookie planner_session
```

### Relation to ADR 0006

Independent and compatible. ADR 0006 adds `role` to the same user row and
decides *what* a signed-in user may do; this ADR decides *how* they sign in.
Admin and editor accounts will sign in through the same two methods. Whether
`admin` needs MFA is still the owner's open question in ADR 0006; this ADR does
not answer it and does not block it.

## Options considered

| Option | For | Against |
|---|---|---|
| **A (chosen)** — scrypt passwords and hand-written OIDC + PKCE, both issuing the ADR 0004 session | No new dependency; one session model, one CSRF story, `ownerId` code untouched; works without Google configured; small, auditable surface | We own password storage, throttling and the OIDC checks (`state`, `nonce`, PKCE, signature, claims) — code that is easy to get subtly wrong and needs thorough tests |
| B — Auth.js (NextAuth) with Credentials + Google providers | Widely reviewed OAuth handling; more providers later for free | New framework (ADR-gated by itself); its own session and cookie model would have to be mapped onto `plannerSessions`/`ownerId` or replace them; its Credentials provider does not hash passwords for us anyway |
| C — a hosted provider (Clerk, Auth0, Firebase Auth) | MFA, reset and email for free | A paid vendor holding staff identity for an internal tool used by a handful of people; lock-in on the seam ADR 0004 kept thin; re-plumbs every session |
| D — Google only, no passwords | Least code; no password store | Staff without a Google account, or a device signed in to a different one, are locked out with no fallback |
| E — passwords with public self-signup | Customers could self-serve | Nobody asked for it yet; needs email verification and reset, which need an email sender that does not exist |

The runner-up is **B**, and the reason it lost: it brings a second session
system that has to be reconciled with the one ADR 0004 just shipped, for a
saving that is mostly the Google redirect handling — the part of this design
that is smallest. If customers later self-serve with several providers, B is
where this goes, and decision 1 keeps that move to `identify` and the session
rows.

## Consequences

**Easier.** Staff sign in with something they can remember or with the Google
account already on their phone. Operators stop handling long-lived bearer
secrets for people, and a lost password is a reset rather than a token
rotation. The token path, every test and every curl example keep working.

**Harder — and not free.**

- **We store personal data and password hashes.** `.data/planner.json` gains
  email addresses (personal data) and password hashes next to the existing token
  and session digests. The project context's "no PII store" stops being true,
  and must be corrected in the same change. The file must never be committed,
  logged or copied into an uncontrolled backup.
- **New code that must be right:** scrypt parameters and constant-time compare,
  the dummy-hash path, two limiters, the temporary-password gate, and every
  OIDC check. A single skipped check (`aud`, `nonce`, `email_verified`, or the
  one-use `state`) is an account takeover, not a cosmetic bug.
- **Cost per sign-in:** scrypt at `N=2^17` uses about 128 MB and tens of
  milliseconds per attempt. Concurrent sign-ins multiply that; the limiters are
  what keep it bounded, and they are per-process.
- **Email-based linking trusts Google's `email_verified`** and the operator
  typing the right address. A mistyped address links nobody (safe); an address
  that belongs to someone else would link them (unsafe) — so the operator UI
  must show the email clearly, and unlinking exists.
- **Outbound dependency:** Google sign-in needs the server to reach Google's
  token and JWKS endpoints. If they are unreachable, Google sign-in fails and
  password sign-in still works.
- **Owner infrastructure:** a Google Cloud OAuth client, its secret in the
  deployment environment, and the redirect URI registered for every
  environment (local, preview, production).

**Reversing it** means removing the two OAuth routes, the change/reset
endpoints and the `{ email, password }` branch, and ignoring the new optional
fields; the access token stays the root credential, so nobody is locked out and
no data migration is needed.

## Follow-up

Code, once this is accepted (backend-engineer, then frontend-engineer):

- Schema: optional `email`, `passwordHash`, `mustChangePassword`, `googleSub`;
  `oauthAttempts`; uniqueness enforced on write and in the integrity sweep
  (duplicate email, duplicate `googleSub`, malformed hash, expired attempts).
- `auth.ts`: `hashPassword`, `verifyPassword`, the dummy hash; a Google OIDC
  module under `src/server/planner/` (authorize URL, token exchange, JWKS cache,
  `id_token` verification).
- Routes: the `{ email, password }` branch of `POST /api/planner/session`,
  `POST /api/planner/password`, `GET /api/planner/oauth/google/{start,callback}`,
  `POST /api/admin/planner/users/:userId/reset-password`,
  `DELETE /api/admin/planner/users/:userId/google`, and `email` on user creation.
- UI: the sign-in page with email/password, a "Sign in with Google" button
  shown only when configured, the access-token disclosure, a change-password
  page, and every string in both `messages/vi.json` and `messages/en.json`.
- Tests: hash round-trip and parameter parsing; same 401 for unknown email,
  no password and wrong password; email limiter; temporary-password gate;
  change password kills other sessions; reset kills all sessions; `state`
  mismatch, reused `state`, expired attempt, wrong `aud`, wrong `iss`, expired
  token, bad signature, wrong `nonce`, `email_verified: false` all refused;
  match by `sub`, link by email, no match → no user created; Google routes 404
  when unconfigured; bearer path unchanged; client-boundary still passing.

Documents to update in the same change: the feature document
[travel-planner-core.md](../features/travel-planner-core.md) and its twin,
the identity section of [architecture.md](../architecture.md) and its twin,
the sign-in task in [usage.md](../usage.md) and its twin, and
`.claude/context/project-context.md` (sensitive data).

Needs the owner's input:

1. Accept or reject this ADR.
2. Create a Google Cloud OAuth client (Web application) and register the
   redirect URI for each environment; put `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` in the deployment environment — never in the
   repository or in chat.
3. Do staff use Google Workspace on a company domain? If so, Google sign-in can
   additionally require that domain (`hd` claim) — a one-line restriction.
4. Whether `admin` accounts require MFA (open in ADR 0006).
