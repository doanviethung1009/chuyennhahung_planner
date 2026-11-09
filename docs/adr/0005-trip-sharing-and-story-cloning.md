# ADR 0005 — Trip sharing and story cloning: capability links over the existing Planner

🇻🇳 Bản tiếng Việt: [0005-trip-sharing-and-story-cloning.vi.md](0005-trip-sharing-and-story-cloning.vi.md)

- **Status:** Accepted — the owner requested the feature "Đi theo dấu chân nhà Hưng" (follow Nhà Hưng's footsteps) on 2026-11-09
- **Date:** 2026-11-09
- **Owner:** system-architect
- **Decided by:** owner (product flow), system-architect (contract)
- **Affects:** `src/content/types.ts`, `src/i18n/routing.ts`, `src/server/planner/**`, `src/server/rate-limit.ts` (new), `src/app/api/planner/**`, `src/app/api/shared/**` (new), the story page and five new pages

## Context

The owner's flow: a reader reads a Travel Story, sees the real itinerary, presses
"Tạo chuyến đi giống nhà Hưng", edits dates, party size and budget in a Trip Setup
step, clones the template into an independent personal trip, finds it in My Trips,
and can share it through a read-only link. An anonymous visitor may read the story
and customise a draft; saving asks them to sign in.

Most of the machinery exists. `POST /api/planner` with `source: 'template'` already
copies a public template into new rows and records a `sourceTemplate` snapshot
([ADR 0002](0002-planner-core.md)); browser sign-in exists
([ADR 0004](0004-planner-identity.md)). What is **new and security-relevant** is the
first unauthenticated read of traveller-owned data (the share link), a capability
token, and the first public endpoints that need abuse control — there is no rate
limiter anywhere in `src/`.

Two facts shape the design. The site's story pages read static seed
`src/content/stories.ts`, while templates live in the Travel Content System, so the
story-to-template link is a new field on the site `Story`. And `trip.status` is
`active | archived` — a lifecycle, not the planning progress the owner asked for.

## Decision

1. **Story–template link.** Optional `Story.plannerTemplateSlug`. The story page
   renders the real itinerary and the CTA only while the template is still public.
   `di-da-lat-lan-thu-sau` → `da-lat-3-ngay-lang-man`.
2. **Attribution is server-derived.** `tripTemplateSnapshotSchema` gains
   `story: { slug, title } | null`, filled by a new read-only
   `PlannerCatalog.getLinkedStory(templateSlug)`. It is never accepted from a
   client. Nullable and optional, so stored trips stay valid.
3. **Planning status is separate from lifecycle.** New `planningStatus:
   'draft' | 'planned' | 'completed'`, default `draft`, settable through the existing
   `PATCH /api/planner/[id]`. Rows without it read as `draft` — no migration. "Delete"
   in My Trips stays the existing two-step: archive, then explicit purge.
4. **Duplicate.** `POST /api/planner/[id]/duplicate`: new ids for every day,
   activity and expense; `planningStatus: 'draft'`, `visibility: 'private'`, no
   token; `sourceTemplate` kept, so attribution survives; `duplicatedFromTripId`
   recorded. The source is untouched.
5. **Visibility and the share token.** Trip fields `visibility:
   'private' | 'unlisted' | 'public'` (default `private`), `shareToken: string | null`,
   `shareTokenCreatedAt`. The token is 32 `crypto.randomBytes` as base64url (43
   characters). Moving to `unlisted` or `public` mints one if absent;
   `POST .../share/rotate` replaces it and the old one dies at once;
   `DELETE .../share` and `PUT {visibility:'private'}` are the same operation — token
   nulled, visibility private. A token is therefore never dormant, so "revoked" can
   never silently come back.
6. **Resolution rule.** A link resolves only when the token matches **and**
   visibility is `unlisted` or `public` **and** the trip is `active`. Every other
   case — unknown, malformed, revoked, private, archived — returns the **same** 404.
   Public is indexable, unlisted is `noindex`; there is **no public gallery** in this
   phase.
7. **Public read** `GET /api/shared/[token]` returns a sanitised projection (the
   contract names it field by field). It excludes owner identity, every internal id,
   `version`, the token, trip-level `note`, and all expenses. It includes activity
   notes and a budget summary (target and estimated total only).
8. **Sharing does not bump `trip.version` and takes no `If-Match`.** `version`
   guards the itinerary an editor is looking at; a share toggle changes none of it,
   and bumping would make the owner's open editor fail with 412 for no content reason.
   The share endpoints are idempotent and serialised by the store queue instead.
   `planningStatus` goes through `PATCH`, so it keeps the existing `If-Match` rules.
9. **Rate limiting.** `src/server/rate-limit.ts`: in-memory sliding window per
   client key with an injectable clock; new error code `rate_limited` (429,
   `Retry-After`) in the shared envelope. Applied to `GET /api/shared/[token]`, to
   the share page render, and to `POST /api/planner/session`. Limits (config
   constants, tunable): share read 60/min/IP, sign-in 10/min/IP.
10. **Session probe.** `GET /api/planner/session` → 200 `{ user, expiresAt }` or 401.
11. **Guest draft.** Trip Setup is viewable anonymously and keeps the draft in
    `sessionStorage` (per tab, no credential in it). Save is `POST /api/planner`; on
    401 the draft is kept and the visitor is sent to `/sign-in?returnTo=…`, which
    restores it afterwards. `returnTo` must be a same-site relative path. There are
    no server-side anonymous drafts.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) Plaintext token in the trip document, compared by SHA-256 + `timingSafeEqual` | Owner can re-display their own link; one field; revoke and rotate are trivial | A leaked store leaks live links |
| B Store only a SHA-256 of the token | A leaked store does not leak live links | Owner can never see the link again, only rotate; and the same document already holds the trip itself, so the leak is already total |
| C `unlisted` only, no `public` | Smaller surface, no indexing question | Owner asked for three visibilities; `public` costs one robots flag |
| D Share by trip id | No new field | Ids are enumerable and appear in URLs the owner already uses; a capability must be independent of identity |
| E Bump `version` on share changes | One consistent rule | Spurious 412 for an editor that changed nothing |

Runner-up for the token is B; it lost because hashing protects nothing here — the
token's target data sits in the same file — while it removes a feature the owner
needs. Runner-up for visibility is C; it lost on the owner's explicit request.

## Consequences

Easier: the whole flow reuses ADR 0002 cloning and ADR 0004 sign-in; template
immutability stays structural (`PlannerCatalog` has no writer); sharing never grants
edit because the share path is a separate read-only projection with no mutation code.

Harder, and not free:

- **A link is a bearer secret.** Anyone holding it reads the trip until it is rotated
  or revoked. Mitigations: `Referrer-Policy: no-referrer`, `Cache-Control: private,
  no-store`, no listing, no analytics on the path. A page that embeds third-party
  scripts would leak it — none may be added to `/shared/[token]`.
- **Token lookup is a linear scan** of trips, each compared in constant time. Fine in
  one process; it becomes an index in SQL.
- **The limiter is in memory and per process.** It resets on restart and is not shared
  across instances — the same multi-instance trigger as SQL. The client key is the
  first `x-forwarded-for` hop, else `x-real-ip`, else `unknown`; that header is
  spoofable unless a trusted proxy overwrites it. Behind no proxy an attacker rotates
  the header and evades the limit; `unknown` makes all such callers share one bucket.
  The limiter is a speed bump against enumeration, not the defence — the defence is
  256 bits of token.
- **The share page returns 200 when rate limited**, because a page cannot set a status
  after streaming begins; it renders a "try again shortly" state with no trip data.
- **Sign-in is still staff-first.** "Asked to sign in when saving" means entering an
  operator-issued access token. Real self-service sign-up needs its own ADR
  ([ADR 0004](0004-planner-identity.md)).
- **Two trust surfaces for trips**: the owner API and the public projection must
  agree. A projection test enumerates the allowed fields so a new `Trip` field cannot
  leak by default.
- Reverting means dropping the share fields and routes; stored rows with extra fields
  remain readable.

## Follow-up

- Contract and owner split: `.claude/contracts/follow-hung-footsteps.md`.
- [architecture.md](../architecture.md) updated (routes, data, boundaries, phases).
- Feature document `docs/features/follow-hung-footsteps.*` — written by
  `frontend-engineer`.
- Open: a public gallery of `public` trips, owner-chosen redaction of budget, and a
  real identity provider each need their own ADR. Owner to confirm the sign-in limit.
