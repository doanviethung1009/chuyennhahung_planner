# Task Contract: follow-hung-footsteps — "Đi theo dấu chân nhà Hưng"
- Class: XL (first unauthenticated read of traveller data, capability tokens, rate limiting, Trip contract change, new routes)
- Desired outcome / user impact: a reader of the Đà Lạt story sees the real itinerary, customises a draft anonymously, signs in on save, gets an independent trip in My Trips, and can share it by a read-only link. The original template, blog, tours and existing auth are unaffected.
- Scope IN: story–template link; attribution; `planningStatus`; duplicate; visibility + share token (create/rotate/revoke); public read API + page; rate limiter; session probe; five pages (`/sign-in`, `/my-trips`, `/my-trips/[id]`, `/trip-setup/[template]`, `/shared/[token]`); story page itinerary section + CTA.
- Scope OUT: public gallery of public trips; real identity provider/signup; Planner map; AI; SQL; server-side anonymous drafts; full itinerary editor in My Trips detail (view + status/share/duplicate/delete only); `/plan-your-trip` (untouched); tour redirects (untouched); owner redaction of budget.
- Evidence: `src/server/planner/{repository,schemas,http,auth,store,catalog,instance}.ts`; `src/app/api/planner/**`; `src/server/content/errors.ts` (no `rate_limited` code yet); `src/content/types.ts` (Story); `src/content/stories.ts` (`di-da-lat-lan-thu-sau`); `src/content/travel/seed.ts:445` (`da-lat-3-ngay-lang-man`); ADR 0002, 0004, 0005.
- Constraints / dependencies: CLAUDE.md rules 1, 2, 4, 5, 6; no new runtime dependency (use `node:crypto`); both locales for every string.
- Architecture decision / ADR: `docs/adr/0005-trip-sharing-and-story-cloning.md` (+ `.vi.md`), Accepted.

## Already done by the architect
`src/i18n/routing.ts` (five pathnames), `Story.plannerTemplateSlug?` in `src/content/types.ts`, ADR 0005, `docs/architecture.*`. `tests/docs.test.ts` + `tests/routing.test.ts` pass.

## Interface contract
Error envelope: unchanged from `src/server/content/http.ts`. Add code `rate_limited` -> 429 in `errors.ts`, with `Retry-After` (integer seconds) header. All owner-only endpoints: resolve identity via `resolveIdentity`; a trip the caller does not own is **404** (existing convention); cookie-authed mutations call `requireSameOrigin`.

### Schema changes (`src/server/planner/schemas.ts`, all backward compatible — missing on stored rows)
- Trip: `planningStatus: 'draft'|'planned'|'completed'` (read default `draft`); `visibility: 'private'|'unlisted'|'public'` (read default `private`); `shareToken: string|null` (default null); `shareTokenCreatedAt: string|null`; `duplicatedFromTripId: string|null`.
- `tripTemplateSnapshotSchema`: add `story: { slug: string; title: Localized } | null` (optional on read -> null).
- `tripUpdateSchema`: add optional `planningStatus`. **`visibility`, `shareToken` and the other share fields are NOT accepted by create, PATCH or duplicate bodies** (strict schema -> 422): they change only through the share endpoints.
- `PlannerCatalog.getLinkedStory(templateSlug): { slug, title: Localized } | null` — read-only, reads site `stories` where `plannerTemplateSlug === templateSlug`.

### Owner endpoints (`src/app/api/planner/[id]/…`)
| Method + path | Body | Success | Notes |
|---|---|---|---|
| `PATCH /api/planner/[id]` | existing + `planningStatus?` | 200 trip | existing `If-Match`/version rules; unchanged |
| `POST /api/planner/[id]/duplicate` | `{ title?: string }` (1–120) | 201 trip | active source only (archived -> 409 `invalid_state`); new ids for days/activities/expenses; `planningStatus:'draft'`, `visibility:'private'`, token null, `sourceTemplate` copied, `duplicatedFromTripId` = source id, `version` 1; source row byte-identical afterwards. No `If-Match`. |
| `PUT /api/planner/[id]/share` | `{ visibility: 'private'\|'unlisted'\|'public' }` | 200 `{ visibility, shareToken: string\|null, shareTokenCreatedAt: string\|null }` | non-private mints a token if none, else keeps it; `private` nulls the token (== revoke). Idempotent. Does **not** bump `version`, no `If-Match`. Archived -> 409. |
| `POST /api/planner/[id]/share/rotate` | none | 200 same shape | trip must be `unlisted`/`public` else 409 `invalid_state`; new token, old dead at once. |
| `DELETE /api/planner/[id]/share` | none | 200 `{ visibility:'private', shareToken:null, shareTokenCreatedAt:null }` | idempotent. |
| `GET /api/planner/session` | none | 200 `{ user: {id, displayName}, expiresAt }` / 401 | no credential material in the body; check `src/server/planner/auth.ts` for the existing user shape and reuse it. |
The API returns no share URL; the client builds `/shared/<token>` locale-aware.
Token: `randomBytes(32).toString('base64url')` (43 chars, regex `^[A-Za-z0-9_-]{43}$`). Stored plaintext. Lookup compares `sha256(candidate)` to `sha256(stored)` with `timingSafeEqual` over all non-archived shared trips.

### Public endpoint
`GET /api/shared/[token]` — no auth, **GET only** (others -> 405), never mutates, no cookies read. Malformed token (fails regex) -> 404 *before* any lookup. Unknown / revoked / private / archived -> the **same 404 body**. Success 200 `SharedTripView`:
```
{ title, destination, startDate, endDate, durationDays, partySize, travelStyle, pace,
  planningStatus, visibility: 'unlisted'|'public',
  days: [{ dayNumber, title, date, activities: [{ order, title, placeName?, startTime?, endTime?, category, note? }] }],
  budget: { currency:'VND', targetTotalVnd: number|null, estimatedTotalVnd: number },
  attribution: { templateTitle, story: { slug, title }|null, clonedAt } | null }
```
Excluded, enforced by an allow-list builder (never spread the Trip): `ownerId`, any owner name/handle, every `id`, `version`, `shareToken*`, `duplicatedFromTripId`, trip-level `note`, all expenses and per-expense amounts, `status`. Use real field names from `schemas.ts`; if a listed field does not exist, omit it rather than invent it. Headers: `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` when `unlisted`, `X-Content-Type-Options: nosniff`.
Repository: `getSharedTrip(token): SharedTripView | null` — the single source for both the API and the page.

### Rate limiter (`src/server/rate-limit.ts`)
`createRateLimiter({ limit, windowMs, now? })` -> `{ check(key): { ok: true } | { ok: false, retryAfterSeconds } }`; sliding window, injectable `now`, periodic pruning of idle keys (bounded memory). `clientKey(headers)`: first hop of `x-forwarded-for` (trimmed, capped length), else `x-real-ip`, else `'unknown'`. Instances: share read 60/min, sign-in 10/min, separate buckets. Applied to `GET /api/shared/[token]`, `POST /api/planner/session`, and (via the same limiter, using `headers()`) the `/shared/[token]` render. Page behaviour when limited: render a noindex "try again shortly" state with no trip data. Caveats documented in ADR 0005.

### Types shared with the frontend
Backend exports `SharedTripView` and the extended `Trip` types from `src/server/planner/schemas.ts`. Frontend imports types only (`import type`), never server modules at runtime except `getSharedTrip` and the content repository from server components.

### Frontend contract
- Story page: when `story.plannerTemplateSlug` resolves to a public template via the content repository, render "Lịch trình thực tế" (days + places, server-rendered) and a CTA `Link` to `/trip-setup/[template]`; otherwise render neither. Set `plannerTemplateSlug: 'da-lat-3-ngay-lang-man'` on `di-da-lat-lan-thu-sau` in `src/content/stories.ts`.
- `/trip-setup/[template]`: server-reads the public template (404 if absent); client form (client component: form state + `sessionStorage`) for title, start date, party size, budget, style, pace, note. Draft key `cnh:trip-setup:<template>`; **no credential, token or user data in it**; cleared after a successful save. Submit -> `POST /api/planner` `{source:'template', templateSlug, …}`; 401 -> keep draft, navigate to `/sign-in?returnTo=<this path>`; 201 -> `/my-trips/<id>`.
- `/sign-in`: access-token field -> `POST /api/planner/session`; `returnTo` accepted **only** if it starts with a single `/`, not `//`, no `\`, no scheme, and matches a known localized route; else default `/my-trips`. 429 -> show retry message.
- `/my-trips`: list (title, destination, dates, planningStatus, visibility), status change, duplicate, archive; archived tab with restore and explicit purge. Unauthenticated -> redirect to sign-in with `returnTo`.
- `/my-trips/[id]`: read the trip, set planningStatus, share panel (visibility select, copy link, rotate, revoke), attribution to the story. The shown link is built from the returned token; the token is never put in the page `<title>`, logs or analytics.
- `/shared/[token]`: server component, `dynamic = 'force-dynamic'`, uses `getSharedTrip`; unknown -> `notFound()`; `metadata.robots`: `{index:true}` for `public`, `{index:false, follow:false}` for `unlisted` and for the limited state; `referrer: 'no-referrer'`; **no third-party scripts, no embeds, no analytics**; no edit controls; shows attribution with a link to the story.
- Private pages `metadata.robots: {index:false}`; none in `src/app/sitemap.ts`. Every page still needs `generateMetadata` and localized alternates (`/shared/[token]` alternates omitted — a token must not be advertised across locales). All strings in `messages/vi.json` and `messages/en.json`. Respect rules 4 and 5 (no dead buttons, a11y, 44px targets, one `h1`).

## Tasks by owner
- Architect: done (above). Update `.claude/context/project-context.md` is deferred to the implementers' report: backend adds module rows; architect to do a short follow-up if asked.
- BE (one invocation, first): schema changes; repository methods (`duplicate`, `setVisibility`, `rotateShareToken`, `revokeShare`, `getSharedTrip`, `getLinkedStory` on the catalog); routes under `src/app/api/planner/[id]/{duplicate,share,share/rotate}`, `src/app/api/planner/session` (GET + rate limit on POST), `src/app/api/shared/[token]`; `src/server/rate-limit.ts`; `rate_limited` in `errors.ts`; update `tests/*` for the planner backend; `docs/travel-planner-api` section if the planner API doc exists (check `docs/`; it is the BE's to extend, both languages, only if it already exists).
- FE (one invocation, after BE): everything under Frontend contract; `src/app/[locale]/{sign-in,my-trips,trip-setup,shared}/**`, story page, `src/components/**`, `messages/*.json`, `src/content/stories.ts`; **writes `docs/features/follow-hung-footsteps.md` + `.vi.md`** and registers it in `docs/features/README.*`. It documents the API section from this contract and the BE's actual behaviour.
- QC / Security: not scheduled. Recommended on the user's call: `/sec-check` (public unauthenticated read, token handling, rate limiter, open-redirect via `returnTo`) — strongly; `/qc-check` — yes (XL).
- Git: main session, one branch, separate commits per owner.

## File ownership (no overlap)
- BE only: `src/server/**` (incl. `src/server/rate-limit.ts`, `src/server/content/errors.ts`), `src/app/api/**`, backend tests (`tests/planner-*.test.ts`, `tests/rate-limit.test.ts`).
- FE only: `src/app/[locale]/**`, `src/components/**`, `messages/*.json`, `src/content/stories.ts`, `src/app/sitemap.ts` (verify exclusions), `docs/features/**`, frontend tests.
- Architect (done; read-only for engineers): `src/i18n/routing.ts`, `src/content/types.ts`, `docs/architecture.*`, `docs/adr/**`.
- If either needs a change in another's files it requests it, it does not edit.

## Acceptance criteria / tests
BE (`npm run test`):
1. Share lifecycle: private->unlisted mints a 43-char token; `GET /api/shared/<token>` 200; rotate -> old token 404, new 200; revoke/`private` -> 404 and `shareToken` null; re-share yields a different token.
2. No oracle: unknown, malformed, revoked, private-with-valid-token, archived all return byte-identical 404 bodies and status.
3. Projection leakage: response JSON contains none of `ownerId`, `shareToken`, `version`, any `id` key, `note` of the trip, `expenses`; an allow-list test fails if a new `Trip` field appears in the output.
4. Authorization: another traveller's `share`, `rotate`, `revoke`, `duplicate`, `PATCH planningStatus` -> 404; unauthenticated -> 401; cookie-authed cross-origin -> 403 existing CSRF behaviour.
5. Share body rejects `shareToken` / unknown keys (422); create/PATCH/duplicate bodies cannot set `visibility` or `shareToken`.
6. Duplicate: new ids everywhere (no id shared with source), status draft, private, token null, `sourceTemplate` equals source's, source row unchanged (deep-equal before/after); archived source -> 409.
7. Template immutability: cloning from a template and mutating the clone leaves the content-store template unchanged.
8. Attribution: `sourceTemplate.story` is derived from the linked story (assert for `da-lat-3-ngay-lang-man`), a client-supplied `story` is rejected/ignored per strict schema, trips stored without it parse as `null`.
9. Back-compat: a stored trip fixture lacking all new fields loads as `draft`, `private`, token null.
10. Rate limiter unit tests with a fake clock (limit, window slide, separate keys, prune); `/api/shared` and `POST /api/planner/session` return 429 with `Retry-After` and envelope code `rate_limited`; `clientKey` precedence tests.
11. `GET /api/planner/session`: 200 with cookie and with bearer, 401 without; body carries no token.
12. Headers on the 200 and 404 shared responses (`Cache-Control`, `Referrer-Policy`; `X-Robots-Tag` only for `unlisted`).
FE:
13. Story `di-da-lat-lan-thu-sau` renders itinerary + CTA; a story with no link, or a withdrawn template, renders neither (no `href="#"`).
14. VI/EN parity (`tests/i18n.test.ts`), routing and docs tests pass; five routes resolve in both locales; no raw token in any server-rendered page except the owner's panel.
15. Open-redirect: `returnTo` of `//evil.com`, `https://evil.com`, `/\evil.com`, `javascript:` all fall back to `/my-trips` (unit-test the validator).
16. Manual (state evidence or NOT RUN): anonymous visit -> customise -> save -> sign-in -> draft restored -> trip saved -> share -> open link in a private window -> read-only, no edit controls. Check 375/768/1280px.
17. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` — output stated; tour redirects test unchanged and green.

## Security and migration risks
- Share token is a bearer secret: no logging of the token or full URL server-side (log a prefix of the hash at most); no third-party scripts on the share page; Referer suppressed.
- Enumeration: mitigated by 256-bit tokens + identical 404s + rate limit; limiter is spoofable via `x-forwarded-for` and per-process (ADR 0005).
- Leakage by projection: allow-list builder + test (criterion 3).
- Open redirect through `returnTo` (criterion 15). XSS: render user text only through React; never `dangerouslySetInnerHTML` on trip fields.
- Mass assignment: strict schemas on share fields (criterion 5).
- Migration: none — all new fields optional with read defaults; old stores load unchanged.
- Sign-in remains operator-issued token; "ask to sign in" is only as good as ADR 0004.

## Rollback approach
Revert the PR. Stored `.data/planner.json` rows keep the extra optional fields and still parse. To kill sharing without a revert, make `getSharedTrip` return null (all links 404).

## Budget
Max 2 implementer invocations (BE then FE). Stop condition: BE reports typecheck/lint/test green before FE starts; any BLOCKED review from the user stops the work; at most two review/fix cycles, then escalate.

## State: IMPLEMENTED (merged PR #23)
## Feature document owner: frontend-engineer — `docs/features/follow-hung-footsteps.md` + `.vi.md`, registered in `docs/features/README.*` (BE supplies the API behaviour per this contract)
## Architecture/usage doc updates needed: `docs/architecture.*` done. `docs/usage.*`: none unless the BE adds an env var (it should not; limits are code constants).

## Addendum: Phase 06 readiness
Phase 06 (Admin Portal & CMS) is announced, not started. Prompt 05's scope and acceptance are unchanged. Identity/role design is in `docs/adr/0006-unified-identity-and-roles.md` (Proposed); backlog in `docs/architecture.md` Phases. Known untested clone guarantees (not covered by this contract's tests): an existing trip's days/activities unchanged after the template is edited or withdrawn (only the integrity report text is asserted, `tests/planner-integrity.test.ts:398`); no shared object references between template and clone (ids only); purging a trip leaves the template untouched.
