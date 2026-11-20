# ADR 0030 — Sharing the member map by token: its own token, a visited-only public projection, anonymous by default

🇻🇳 Bản tiếng Việt: [0030-member-map-sharing.vi.md](0030-member-map-sharing.vi.md)

- **Status:** Proposed
- **Date:** 2026-11-20
- **Owner:** system-architect
- **Affects:** new `member_map_shares` table (migration at the next free number and its `db/rollback` file) and collection `memberMapShares` in `src/server/persistence/planner-rows.ts` and `planner-transfer.ts`; `src/server/planner/schemas.ts`, `repository.ts` (share methods, `deleteUser`), `src/server/planner/member-map.ts` (public projection); new routes `src/app/api/planner/map/share/**` and a public page `/shared-map/[token]`; `src/i18n/routing.ts`; `src/server/rate-limit.ts`; `deploy/nginx/default.conf` (one `access_log` rule); the audit action list. Task Contract `member-map` (slice 2). Refines the slice 2 sketch in ADR 0029 (private member map, slice 1 — not yet on `main` when this was written, so it is not linked); builds on [ADR 0004](0004-planner-identity.md), [ADR 0005](0005-trip-sharing-and-story-cloning.md) and [ADR 0025](0025-member-profiles-and-use-this-trip.md).

## Context

Slice 1 gives a member a private map at `/my-map`. The owner decided (2026-11-20) that a member may also share it by a link, that the shared map shows **only places already visited**, and that the name is **anonymous by default**. The security review of the design (`/sec-check`, PASS_WITH_WARNINGS) set nine requirements that this ADR must settle before any code.

Facts from the code:

1. **Trip sharing is the model, not the template.** A trip's token is 43 base64url characters (`SHARE_TOKEN_PATTERN`, `schemas.ts:105`), looked up by SHA-256 digest and re-checked against a fresh read with `timingSafeEqual`; every failure returns `null` (`getSharedTrip`, `repository.ts:2562-2587`). But the token itself is stored **raw** on the trip, and the lookup keeps a cached digest index.
2. **Cookie mutations must prove their origin.** `requireSameOrigin` (`src/server/planner/http.ts:116`) refuses a cross-site mutation and requires `Origin` or `Sec-Fetch-Site` on a cookie-authenticated non-GET.
3. **A disabled account must disappear.** `isDisabled(user)` (banned or soft-deleted) is how sign-in already treats such accounts (`repository.ts:386`); `deleteUser` removes the user's rows by hand in one transaction (`repository.ts:~1070`, as for `termsAcceptances`).
4. **The audit table already has `targetKind: 'user'`** (`schemas.ts:893`) and a free-text `action` (≤40).
5. **`displayName` is only `trim().min(2).max(80)`** (`schemas.ts:148`), so it can hold an email or a phone number. ADR 0025's public-profile gate `profilePublicOpen` is **designed but not built**: it appears in documents only.
6. **Persistence has one pattern for a per-user table** (migration `0012_terms_acceptances.sql`: `seq`, `id`, no foreign keys, rollback file, import/export in `planner-transfer.ts`).

What we do not know: how many members will share; whether the owner's Privacy Policy covers a public name (it is not written); whether nginx on the VM caches or logs these paths (the repository holds `deploy/nginx/default.conf`; the live VM was not inspected).

## Decision

### 1. Storage: one row per member, the token stored as a digest

- Table `member_map_shares`, 1:1 on `user_id` (unique): `token_digest` (SHA-256 hex, 64, **unique, nullable** — null means "not shared"), `share_name` (`anonymous` | `name`, default `anonymous`), `created_at`, `updated_at`. No foreign key (ADR 0013). A missing row reads as "not shared, anonymous".
- The token is 43 characters from `randomBytes(32)`, the same shape as a trip's. It is **shown once**, in the response that issues or rotates it; only its digest is stored. The cost: a member who loses the link must rotate it (the old link dies). That is accepted: a database or backup read must not yield working links, which is not true of trip tokens today (a separate hardening for trips is out of scope).
- Migration additive, default private, with a rollback file. **No agent applies a migration to production.**

### 2. The public projection: visited only, coarse, stable

- Source: trips of the member with `planningStatus = completed`, **archived or not**; destination must exist in the `destinations` seed. Reviews and their self-declared `visitedOn` are **not** used. Planned places never appear.
- Type `PublicMemberMap = { displayName: string | null; points: PublicMemberMapPoint[] }`, `PublicMemberMapPoint = { slug; visitsBucket: 1 | 2 | 3 }`, a **separate type** from slice 1's private point so a planned point cannot be serialised by mistake. Buckets: 1 trip → 1, 2–3 → 2, 4 or more → 3 (drawn with the existing `pinRadius`, three sizes). Points are sorted by `slug`; no timestamps, trip ids, titles, dates, counts of private items or review text.
- The projection is computed from live data on every request. Deleting a completed trip removes its point at once; archiving a completed trip keeps it (the same rule as the private map).
- A member sees a **preview** of exactly the public projection in the share settings before enabling. With fewer than 2 visited places the settings warn that a sparse map is easier to recognise; it is a warning, not a block.

### 3. Name: anonymous by default, never inherited

- `share_name = anonymous` returns `displayName: null`. `name` returns the member's `displayName`, **read fresh at render**, never snapshotted; it is the same one public name as in ADR 0025 (no separate map name).
- Choosing `name` is refused with `422 display_name_unsuitable` when the current `displayName` looks like an email address (contains `@`) or a phone number (7 or more digits). The member changes their name first. This is a guard against accidents, not proof of identity safety.
- **Until `profilePublicOpen` exists and is on**, `name` is refused with `403 share_name_unavailable`: slice 2 first ships anonymous-only. This reuses ADR 0025's gate instead of inventing another, and waits on the owner's Privacy Policy (owner question 1).
- The name never appears in `<title>`, metadata, Open Graph, the URL, logs or audit rows. Where a name is shown it is plain text in the page body.

### 4. Owner API (cookie session of the member only)

| Method and path | Effect |
|---|---|
| `GET /api/planner/map/share` | `{ enabled, shareName }` — never the token |
| `PUT /api/planner/map/share` | Strict body `{ enabled, shareName }`. Idempotent: enabling a map that already has a token keeps it and returns no token; enabling one without issues a token and returns it **once** |
| `POST /api/planner/map/share/rotate` | New token, returned once; the old one dies in the same transaction |
| `DELETE /api/planner/map/share` | Revokes (`token_digest = null`); repeating it succeeds |

The principal is the session's user: no `userId` or slug is read from a body or a path. Bodies are `.strict()` Zod schemas validated in the handler. Mutations go through the existing same-origin check (fact 2) and the same envelope. Mutations have their **own** limiter bucket per user (proposed 20 per hour); the public read has its own bucket, not shared with trips, so one cannot burn the other's budget.

### 5. The public page `/shared-map/[token]`

- Route `/shared-map/[token]` ↔ VI `/ban-do-chia-se/[token]`. A **page only**: no public JSON endpoint, so the allow-listed projection has one surface.
- **One answer for every failure** — `notFound()` with the same body for: malformed token, unknown token, revoked, not shared, owner banned, owner soft-deleted, owner deleted. Order of checks: token format → read limiter (`429` leaks nothing about the token) → lookup by digest → **fresh read** → `timingSafeEqual` on the digests → owner exists and `!isDisabled` → build the view. The lookup reads the row directly (no cached index): the table is small and the rate limiter bounds the cost, and it removes the stale-index case.
- Headers and metadata: `force-dynamic`, `Cache-Control: private, no-store`, `robots: noindex, nofollow`, `Referrer-Policy: no-referrer`, no `alternates`/`hreflang`, not in the sitemap, no JSON-LD and no Open Graph. The title is generic.
- The token is in the URL, so the access log would hold it. `deploy/nginx/default.conf` turns `access_log` off for these two locations, and nginx must not cache them. The live VM is verified by the PR, not assumed.

### 6. Lifecycle, audit and transfer

- `deleteUser` deletes the member's share row in the same transaction. A banned or soft-deleted user's link answers 404 while the row stays; a restore revives the same link.
- Audit rows (`targetKind: 'user'`, `targetId` = the user id, in the same transaction): `map_share_on`, `map_share_off`, `map_share_rotate`, `map_share_name`. No token, no name, no destination in any row, log line or error.
- Export (`planner-transfer.ts`) does **not** carry `token_digest`. Import creates every row with `token_digest = null` and `share_name = anonymous`: **importing a file never publishes anything**.

### 7. Slices, order and review

1. **2a** store, migration, owner API, audit, `deleteUser`, transfer — no public page yet.
2. **2b** the public page and its tests.
3. **2c** the controls and preview on `/my-map`, and the one-time link display.

`/sec-check` runs on the code of 2a and 2b (recommended, called by the owner). A BLOCKED stops that slice.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) Own token, stored as a digest, shown once; visited-only coarse projection; anonymous by default; page only | A leaked database or backup yields no working link; planned trips are never exposed; one public surface | A lost link must be rotated; a more careful UI (preview, show-once) |
| B Reuse a trip's share mechanics and store the token raw | Least code | Inherits raw tokens at rest; a trip token and a map token would be confusable |
| C Show the map on the member's public profile (ADR 0025) | Discoverable | Profiles are not built; public by default is rejected there; enumeration risk |
| D Also expose a public JSON endpoint | Lets other pages embed it | A second surface to allow-list, rate-limit and test |

The runner-up is **B**. It lost on the one reason that token storage should not copy a weaker pattern into a new feature.

## Consequences

Easier: a member can show where they have been without an account on the other side; nothing private or forward-looking is reachable by construction; revocation is immediate and the link is useless without the row.

Harder, and not free:

- **A lost link cannot be recovered**, only replaced.
- **Two pieces of owner work gate the name:** the Privacy Policy and `profilePublicOpen`; until then only anonymous maps ship.
- **A sparse map can still identify its owner to someone who already knows them** (a place only they have visited); the preview and warning reduce this, they do not remove it.
- **The nginx rule and a VM check are real work** and cannot be proven from the repository alone.
- **No page lookup cache:** every view reads the row and the member's trips; the limiter bounds it, and a very large account is the same scaling note as slice 1.
- Reverting drops the table and every issued link; before a rollback, revoke all tokens or disable the route so old links answer 404.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Name leaks through `displayName` holding contact details | `422` guard, name mode gated, name only in the body, never in metadata or logs |
| Existence of a token or an account inferred | One 404 for every failure, constant-time compare, limiter that leaks nothing |
| Private or planned data in the public body | Separate public type, enumerating test, visited-only source, buckets |
| Link stored raw and leaked from a backup | Digest only; export drops it; import never publishes |
| Cross-site mutation of the setting | Existing same-origin rule plus a test from another origin |
| Token in access logs or a CDN cache | nginx `access_log off`, no cache, `no-store`, `no-referrer` |

## Follow-up

- Implementation: slices 2a–2c; each ships its feature-document update in both languages (`docs/features/member-map.*`) and the `docs/architecture.*` rows (routes, data, API). A migration number is taken at merge order (ADR 0025 also reserves `0016`/`0017`).
- Tests: enumerating allow-list of the public body; planned and review-only places absent; archived-completed shown, deleted trip gone; two members isolated (A's token never returns B; B's `PUT`/`DELETE` never change A); the same 404 for every failure branch including banned, soft-deleted and deleted owner; `429` leaks nothing; cross-origin mutation refused; no token in audit, logs or export; import never enables sharing; `deleteUser` removes the row; anonymous HTML and JSON contain no name string, and a renamed or deleted user's old name never appears.
- Reviews: `/sec-check` on the code of 2a and 2b: NOT RUN (recommended). Verify nginx on the VM does not cache or log these paths.
- Owner decisions (recommendation first):
  1. **Name mode.** Recommended: ship anonymous-only first and open `name` with `profilePublicOpen` once the Privacy Policy is published. Alternative: build a separate gate for the map only.
  2. **Visit buckets.** Recommended: 1, 2–3, 4 or more. Alternative: only "visited" with no size.
  3. **Show the link once.** Recommended: yes (digest only). Alternative: store it raw so it can be shown again, at the cost of a weaker store.
