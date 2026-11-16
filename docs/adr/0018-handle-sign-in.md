# ADR 0018 — Sign in with an account handle, and password reset without an email

🇻🇳 Bản tiếng Việt: [0018-handle-sign-in.vi.md](0018-handle-sign-in.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-16
- **Owner:** system-architect

## Context

[ADR 0007](0007-password-and-google-sign-in.md) signs a user in with an email and a password, and `resetUserPassword` refused any account with no email (`409 invalid_state`). An operator-created account without an email therefore could never get a password, and the admin console showed the unrelated "cannot change your own role…" text for that 409. The owner wants such accounts to sign in with the account code (the handle).

## Decision

1. `POST /api/planner/session` accepts `{ identifier, password }`; `identifier` is an email or a handle. The old `{ email, password }` body is still accepted and read as an `identifier`.
2. The server lower-cases and trims it, and looks the account up by email when it contains `@` (a handle cannot), otherwise by handle. Handles and emails are unique, so there is one candidate at most.
3. Unchanged on purpose: one generic `401` for unknown account, no password, wrong password and (as `isDisabled`) a banned or soft-deleted account; one scrypt run in every case; the per-IP and per-account rate limits (the account bucket is keyed by the matched account's id, so handle and email share one bucket); the temporary-password gate.
4. `resetUserPassword` no longer requires an email. The handle is the sign-in name, so a reset on an account with no email now works.
5. No schema or migration change; the stored handle is already lower-case.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): one `identifier` field, email or handle | One form, no enumeration signal, small change | One extra snapshot read per attempt to resolve the key |
| B: a separate handle field or route | Explicit | Two sign-in shapes to keep identical; the form must ask which |

B lost because it adds a surface without a benefit.

## Consequences

Easier: an email-less account can be given a password and used at once. Harder: a handle is now a login name, so a handle that is guessable is an online-guessing target; the existing rate limits and 12-character temporary passwords are the defence, and a handle is never shown to anyone who is not signed in.

## Follow-up

Run `/sec-check` (authentication change). Feature document: [handle-sign-in](../features/handle-sign-in.md).
