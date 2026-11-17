# Feature — Creator Terms acceptance

🇻🇳 Bản tiếng Việt: [creator-terms.vi.md](creator-terms.vi.md)

## Summary

A signed-in member must accept the **current version** of the Creator Terms before the server accepts a listing request or a Planner review from them. Acceptance is recorded per user and version and logged as an audit event. Reading, withdrawing a listing and deleting one's own review are never blocked, and guest reviews are not affected (no account). ADR [0019](../adr/0019-community-foundation.md) §4, batch 10.4.

The terms text (`contribution.terms`, VI + EN) now covers eight articles: scope, ownership, Chuyện Nhà Hưng's licence, copying a Planner, place reviews, prohibited content and moderation powers, data, and removal / changes. A guest agrees by submitting a review (Article 1.2). Current version: `2026-11-18` (D5). It does not mention images or video (no upload exists), links to no Privacy Policy (none exists), and has no governing-law, minimum-age or liability text (owner decision, to be added only after legal advice).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `GET /api/planner/terms` | same | same |
| `POST /api/planner/terms` | same | same |

Browser session or access token; a cookie session must send `Origin` / `Sec-Fetch-Site` and be same-origin (ADR 0010), like every mutation. `GET` → `{ version, accepted, acceptedAt }`. `POST { version, lang? }` → `200 { version, accepted: true, acceptedAt }`; `version` must equal the current one (else `400`), unknown body keys (such as `userId`) are `422`; the user is always the session's. Idempotent.

The gate: `PUT /api/planner/[id]/listing` and `PUT /api/planner/reviews/[placeSlug]` answer `403 { error: { code: 'forbidden', reason: 'terms_not_accepted' } }` until the current version is accepted. No new error code.

## Data

`TermsAcceptance` — `id` (`trm_…`), `userId`, `version`, `acceptedAt`, `lang` (`vi` | `en`). Table `terms_acceptances` (migration `0012_terms_acceptances.sql`, manual rollback `db/rollback/0012_terms_acceptances.sql`), JSON key `termsAcceptances`; `UNIQUE (user_id, version)` (the store engine keys rows by `id`, so the natural key is a unique constraint rather than the primary key); no foreign keys (ADR 0013). Personal data: a user id and a time; no IP address, no user agent. A permanent account delete removes the member's rows. The version is `termsVersion` in `src/content/site.ts` (a date, `YYYY-MM-DD`, first `2026-11-16`, current `2026-11-18`; see the changelog below).

Event: `terms_accepted`, `targetKind: 'user'`, `targetId` and `actorId` = the member, `toStatus` = the version; written only on the first acceptance (a repeat writes nothing).

## How it works

The owner bumps `termsVersion` whenever the text changes. `tests/terms-version.test.ts` pins a SHA-256 of both texts to a version and fails if the text changes without a bump (or a bump without re-pinning), printing the new hash. After a bump every member is closed out of writes again until they accept.

`PlannerRepository.requireTermsAccepted(userId)` is the gate helper; the two write routes call it right after parsing the body and **before** the rate limiter, so a refused attempt uses no quota. Batches 10.5/10.6 reuse it for any new community write. The repository methods `requestListing` and `upsertPlannerReview` are not gated themselves; the gate is in the routes. `acceptTerms` runs in one store transaction with its event.

UI: `src/components/planner/terms-accept.tsx` (checkbox, label tied to the input, 44px row, status text) in the share panel (listing request) and in the Planner review form; the submit button stays disabled until accepted, and a `403 terms_not_accepted` shows a localized message. Strings: `creatorTerms` in `messages/vi.json` and `messages/en.json`.

### Changelog

The database stores only the version string, never the text; this table plus git history is the evidence of what a member accepted. The text hash is SHA-256 of `vi + "\n---\n" + en`, as pinned in `tests/terms-version.test.ts`.

| Version | Date | SHA-256 | Change |
|---|---|---|---|
| `2026-11-16` | 2026-11-16 | `3b8eed26e41196cec2ea4f4ca08e435f58671876ef770da9b07913f6c2513bca` | First text: creator-only, three articles (git tag `terms-2026-11-16` marks it, owner action) |
| `2026-11-18` | 2026-11-18 | `d552c7cff9fd66d504bf1ea301a5a190034600769e446b761ff8d8e2534bb7f2` | Terms v2: adds place reviews, moderation, reports, data, removal and changes; rewrites copying (ADR 0025 wording); drops image/video mention |

## Files

| Path | Role |
|---|---|
| `src/content/site.ts` | `termsVersion` |
| `src/server/planner/{schemas,store,repository}.ts` | `termsAcceptanceSchema`, collection, `termsStatus`, `acceptTerms`, `requireTermsAccepted` |
| `src/server/persistence/{planner-rows,planner-transfer}.ts` | table mapping, strict import/export schema |
| `src/app/api/planner/terms/route.ts` | GET / POST |
| `src/app/api/planner/[id]/listing/route.ts`, `src/app/api/planner/reviews/[placeSlug]/route.ts` | gate |
| `src/components/planner/{terms-accept,share-panel}.tsx`, `src/components/reviews/review-form.tsx` | UI |
| `db/migrations/0012_terms_acceptances.sql`, `db/rollback/0012_terms_acceptances.sql` | table and rollback |

## Tests

`tests/terms-acceptance-cases.ts` (shared) runs on the memory store in `tests/terms-acceptance.test.ts` and on PostgreSQL in `tests/planner-postgres.integration.test.ts`: closed then open, idempotent (one row, one event), per user, version bump closes again, stale version refused with no event, withdraw/read not gated, account delete drops rows. `tests/terms-acceptance-routes.test.ts`: status, accept, anonymous 401, cross-origin 403, stale version 400, `userId` in body 422, both gates 403 with the reason, then 200. `tests/terms-version.test.ts`: text-without-bump. Existing tests that write a Planner review through the route accept the terms first (helper line); no assertion changed. The PostgreSQL cases skip without `TEST_DATABASE_URL`; CI runs them.

## Limits and open questions

- Owner: a lawyer should read Article 3 last sentence, 4.4, 4.6 and 5.3 and confirm that guest consent by submitting (1.2) is valid; any change is another version bump.
- Article 4 describes copying per ADR 0025 (Proposed); if Q2–Q4 or Q6 change, Article 4 must be reworded and the version bumped again.
- Bumping closes every member out of listing requests and Planner reviews (`403 terms_not_accepted`) until they accept `2026-11-18`; there is no notification.
- The repository methods are not gated, only the routes; a new write route must call `requireTermsAccepted`.
- No re-acceptance email or notification; members find out at the next write.
- Older code rejects a JSON export containing `termsAcceptances` (`.strict()`).
- Rollback: remove the two gate calls and the route (writes work as before), run the rollback SQL by hand; stored rows are inert.
- `/sec-check` (privacy of the table, CSRF on the accept route) is recommended and has not been run.
