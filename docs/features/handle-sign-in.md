# Feature — Handle sign-in and password reset without email

🇻🇳 Bản tiếng Việt: [handle-sign-in.vi.md](handle-sign-in.vi.md)

## Summary

A user can sign in with an email or an account handle plus a password ([ADR 0018](../adr/0018-handle-sign-in.md)). The admin "Reset password" action now works for accounts that have no email, which was the reason an operator could not issue them a password.

## Routes

`POST /api/planner/session` body `{ "identifier": "<email or handle>", "password": "…" }` (the old `{ "email", "password" }` still works). `POST /api/admin/planner/users/[userId]/reset-password` no longer answers 409 for an email-less account. Page: `/dang-nhap` (`/sign-in`).

## Data

No stored data changes. Message keys `signIn.description`, `signIn.divider`, `signIn.emailLabel`, `signIn.errorCredentials` and `admin.users.create.emailHint` were reworded in `messages/vi.json` and `messages/en.json`.

## How it works

1. The form sends `identifier`; the schema trims and lower-cases it.
2. `signInWithPassword` finds the account by email when the value contains `@`, otherwise by handle, and skips banned or deleted accounts.
3. Unknown account, no password, wrong password and disabled account all answer the same `401` after one scrypt run; the per-IP and per-account rate limits apply.
4. A temporary password still sends the user to the change-password page first.
5. Reset password on an email-less account stores a temporary password and ends the user's sessions; the operator gives them the handle and the password.

## Files

| Path | Role |
|---|---|
| `src/server/planner/schemas.ts` | `signInSchema` accepts `identifier` (and legacy `email`) |
| `src/server/planner/repository.ts` | `signInWithPassword` by email or handle; `resetUserPassword` without the email guard |
| `src/app/api/planner/session/route.ts` | Per-account rate-limit key is the matched account's id (`signInBucketKey`) |
| `src/components/planner/sign-in-form.tsx` | Text field labelled email or account code |
| `messages/{vi,en}.json` | Labels and errors |

## Tests

`tests/planner-password.test.ts` asserts that an email-less user can be reset and then sign in by handle, that handle matching ignores case, that unknown handle, no password and wrong password give the same refusal, and that a banned account is refused. `tests/planner-postgres.integration.test.ts` has the same reset-then-sign-in scenario on PostgreSQL; it runs only with `TEST_DATABASE_URL`. Not tested: the form in a browser.

## Limits and open questions

- The sign-in error is one generic message for every failure, and it also hints at Google sign-in or contacting us for accounts with no password, so it neither reveals which accounts exist nor leaves the user stuck.
- A 409 now carries `error.reason` (`self_action`, `last_admin`, `last_super_admin`, `account_disabled`, `not_soft_deleted`, `confirm_handle`) and the admin console shows one message per reason instead of one text for every refusal.
- A handle is now a login name; guessable handles rely on the rate limits and strong temporary passwords.
- Creating a user without an email still issues no password; use Reset password afterwards.
- A review with `/sec-check` is recommended and has not been run.
