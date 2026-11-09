# ADR 0004 — Planner identity: a session cookie over the existing access token

🇻🇳 Bản tiếng Việt: [0004-planner-identity.vi.md](0004-planner-identity.vi.md)

- **Status:** Accepted — the owner accepted it on 2026-11-09; implementation follows
- **Date:** 2026-11-09
- **Owner:** system-architect
- **Decided by:** owner (product scope), system-architect (contract)
- **Affects:** `src/server/planner/auth.ts`, `src/server/planner/http.ts`, `src/server/planner/store.ts`, `src/app/api/planner/**`, and the Planner UI that depends on it

## Context

[ADR 0002](0002-planner-core.md) §3 gave the Planner an interim owner: a
`plannerUsers` row and a 48-byte access token, provisioned by an operator and
presented as `Authorization: Bearer`. It was chosen to keep the existing
bearer-token convention, and it recorded that replacing it needs its own ADR.
`CLAUDE.md` rule 6 now says the same: a real identity provider is not to be
scaffolded without one.

**The Planner UI is blocked on this, which is why it comes first.** The UI is the
open phase, and a browser cannot use the current model. Either a traveller pastes
a 64-character token on every visit, or the token is kept in `localStorage` — and
then any XSS on the site is a permanent account takeover, because the token is
long-lived, cannot expire and is the whole credential. Neither is acceptable for
something the owner's own staff would use daily.

**What the owner has decided about scope:** the Planner is for **Nhà Hưng's own
staff first** — planning trips for customers — with customers possibly
self-serving later. That answer removes a great deal from this round: no public
signup, no password reset, no email delivery. It also rules out committing to a
paid identity vendor for an internal tool used by a handful of people.

**What we do not know.** Whether customers will ever self-serve, and on what
timescale. There is no email sender and no OAuth application; `site.ts` is still
flagged as needing the owner's real contact data. So any option that depends on a
credential channel we do not have cannot ship this round.

**One thing worth stating plainly:** the current model is not broken for scripts
and curl. It is broken for browsers. This ADR therefore adds a browser session
rather than replacing the token.

## Decision

1. **A session is an `HttpOnly` cookie, not a token in a header.** The cookie
   carries an opaque random id and nothing else; the server keeps a
   `plannerSessions` row holding a digest of that id, the `userId`, `createdAt`,
   `expiresAt` and `lastSeenAt`. Attributes: `HttpOnly`, `Secure`,
   `SameSite=Lax`, `Path=/`, no `Domain`. Because the cookie is opaque and the
   digest is what is stored, a leaked store reveals no usable session, exactly as
   with `tokenHash` today.

2. **Sign-in exchanges the existing access token for a session.**
   `POST /api/planner/session` takes the token the operator issued, verifies it
   the way `authorizePlannerUser` already does, and sets the cookie.
   `DELETE /api/planner/session` signs out. No new credential type, no password
   store, and nothing waiting on the owner's infrastructure — provisioning and
   rotation stay exactly as they are.

3. **All identity resolution moves behind one seam.** A single
   `resolveIdentity(request)` tries the cookie first and falls back to
   `Authorization: Bearer` for scripts, curl and tests. `PlannerIdentity` and
   everything below it — `requireOwnedTrip` and every repository method — is
   untouched. This is the whole point of the design: when customers do need to
   self-serve, Auth.js or a hosted provider replaces *that function and the
   session rows*, not every authorization check in the repository.

4. **CSRF becomes a real obligation that the bearer model did not have.** A
   header token is only ever sent deliberately; a cookie is sent automatically by
   the browser on any request to our origin, including one triggered by another
   site. So every mutating Planner route must additionally require a same-origin
   `Origin` (or `Sec-Fetch-Site`) header and reject anything else with 403.
   `SameSite=Lax` is defence in depth, not the defence — it is a browser
   behaviour, and the server must not depend on the client to enforce it. This is
   new code that can be got wrong, and it is the main cost of this decision.

5. **Lifetime and revocation are explicit.** 14 days absolute, 7 days idle. A new
   sign-in always issues a new session rather than extending an old one. Rotating
   a user's token deletes that user's sessions, so the existing
   `rotate-token` endpoint becomes the "sign me out everywhere" control.
   Sessions live in the Planner document, so the integrity sweep gains two
   checks: a session whose `userId` no longer exists, and one that is past
   `expiresAt` and should have been swept.

6. **Deliberately out of scope**, to be decided when and if customers self-serve:
   public signup, password reset, email delivery, OAuth, MFA, and rate limiting
   beyond the request-size limit that already exists. Each of those is a product
   commitment, not a technical detail, and the seam in (3) is what keeps adding
   them from being a rewrite.

## Options considered

| Option | For | Against |
|---|---|---|
| **B (chosen)** — self-managed session cookie over the existing token | No new dependency; needs nothing from the owner; provisioning and rotation keep working unchanged; the cookie is never readable by JavaScript; one thin seam to replace later; unblocks the UI this round | We own session storage, expiry, revocation **and CSRF** — all of it code we have to get right; customers still cannot self-serve, so it is explicitly not the final answer |
| A — keep bearer-only, build the UI around it | Nothing to build | Forces the token into `localStorage` (any XSS becomes a permanent takeover) or into a paste field on every visit. Leaves the open phase blocked, which is the thing we are trying to unblock |
| C — adopt Auth.js (NextAuth) now | Standard and widely reviewed; providers, session rotation and recovery already written; the obvious destination if customers self-serve | Needs a credential channel that does not exist — an email sender or an OAuth app the owner has not supplied; adds a framework, itself ADR-gated; builds a signup flow nobody has asked for; its session model would still need mapping onto `ownerId` |
| D — a hosted provider (Clerk, Auth0, Supabase Auth) | Fastest route to a real login; MFA and account recovery for free; no session code of our own | A paid vendor and a third party holding traveller identity, chosen for an internal tool used by a handful of people; lock-in on precisely the seam we are trying to keep thin |

The runner-up is **C**, and the single reason it lost: it cannot ship this round.
It depends on an email sender or an OAuth application that does not exist yet, so
choosing it now would mean the UI stays blocked until the owner supplies real
infrastructure — for a tool their own staff is waiting to use. If customers ever
self-serve, C is where this is expected to go, and decision (3) exists to make
that move cheap.

## Consequences

**Easier.** The Planner UI becomes buildable: the browser holds no credential it
can read, a visit resumes without re-authenticating, and signing out works. The
existing token path survives untouched, so every test, script and curl example
in the feature document keeps working. Nothing waits on the owner.

**Harder — and this is not a free decision.** We take on session correctness
ourselves: expiry on both axes, no reuse across sign-ins, revocation that
actually revokes, and a sweep for expired rows. We take on **CSRF**, a class of
bug the Planner currently cannot have, and we take it on for every mutating route
at once; a single route that forgets the origin check is a real vulnerability
rather than a cosmetic gap, which argues for enforcing it in
`plannerRoute` rather than per handler. `.data/planner.json` begins holding
session material as well as token digests, which is another reason it is a
separate document from editorial content, and a reason it must never be committed
or copied into a careless backup. Cookie handling makes the API tests slightly
heavier, since a request now has state.

**Reversing it** means deleting the session collection, the two endpoints and the
CSRF check, and pointing `resolveIdentity` back at the bearer path only — a day's
work, and no data migration, because the access token remains the root
credential throughout. That cheapness is deliberate: this is an interim decision
chosen so the next one is not expensive.

**What it does not change.** Object-level authorization is untouched: a trip
still answers 404 to anyone who does not own it, and the operator token still
cannot read a trip. Moving the credential from a header to a cookie changes *how
we learn who is asking*, and nothing about *what they may see*.

## Follow-up

Code, once this is accepted (no code should be written before that):

- `plannerSessions` in `PlannerData`, with its schema and the digest helper.
- `resolveIdentity(request)` in `auth.ts`; `plannerRoute` switched to it, and the
  same-origin check applied there so no route can omit it.
- `POST` / `DELETE /api/planner/session`, plus expiry sweeping on read.
- Two new integrity checks (orphan session, expired session).
- Tests: sign-in and sign-out, cookie attributes, expiry on both axes, no session
  reuse, rotation killing sessions, a cross-origin mutation refused with 403, and
  the bearer fallback still working.

Documents to update in the same change: the feature document
[travel-planner-core.md](../features/travel-planner-core.md) and its twin
(routes, data, limits), the store table in [architecture.md](../architecture.md)
and its twin, and a sign-in task in [usage.md](../usage.md) and its twin.

Needs the owner's input:

1. ~~Accept or reject this ADR.~~ **Accepted 2026-11-09.**
2. **Cookie lifetime** — 14 days absolute / 7 days idle was a guess at what suits
   staff use, and is what the implementation uses. Say if it should be shorter;
   both numbers are single constants.
3. ~~Whether customers will self-serve, and roughly when.~~ Answered before this
   ADR was written: **internal staff first, customers possibly later.** That is
   what selected option B. If that changes, option C is where this goes, and
   decision (3) is what keeps the move cheap.
