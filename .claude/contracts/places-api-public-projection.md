# Task Contract: PLACES-API-PROJ — public places API returns the allow-list, not the raw `Place`
- Class: **L** (changes the public JSON shape of two endpoints; touches a shared projection used by pages) · Branch: `fix/places-api-public-projection` (cut from `main` @ abd54ef) · Origin: /sec-check on PR #176 (PASS_WITH_WARNINGS, pre-existing warning).
- Desired outcome: `GET /api/travel/places` and `GET /api/travel/places/[slug]` expose only the fields the public web pages already expose (ADR 0026 allow-list). No `affiliateLinks`, no `createdAt`/`updatedAt`.
- Scope IN: the two public routes; extract `toPublicPlace` + `PublicPlace` so the routes and `public-places.ts` share one projection; tests for list and detail; `docs/travel-content-api.*`, ADR 0026 amendment (VI+EN, number unchanged), `docs/features/places.*` (note).
- Scope OUT: all `/api/admin/travel/places*` routes (keep raw `Place`, the editor needs every field); repository/store/schema; Planner catalogue (`src/server/planner/catalog.ts` calls the repository, not HTTP); `src/server/community/public.ts` (server-side repository call, never serialised as a `Place`); `q`, `destinationSlug`, `category`, `limit`/`offset` semantics.

## Evidence (step 1 — read only)
- Routes return the repository record unchanged: `src/app/api/travel/places/route.ts:14` (`jsonOk({ places, count })`), `src/app/api/travel/places/[slug]/route.ts:12` (`jsonOk(await repository.getPlace(slug))`). `Place` = `placeInputSchema` + `createdAt`/`updatedAt` (`src/server/content/schemas.ts:170-200`).
- Web pages use the allow-list `PublicPlace` / `toPublicPlace` (`src/server/content/public-places.ts:10-45`), whose doc comment says "affiliate links and timestamps stay out". ADR 0026 decision 3 and context state the same; `docs/features/places.md:20` "Never shown: affiliateLinks, timestamps".
- **Not a documented decision.** `docs/travel-content-api.md:86-94` only lists the public endpoints and says "Read-only"; no document says the public response includes affiliate links or timestamps, nor that it must. ADR 0001:143 says `affiliateLinks` are left empty "no partner programme is in place yet". ADR 0026 line "No database, API or migration change" and the S6 amendment ("response shape unchanged") describe the *shape as it was*, not a promise to expose those fields. So: the full record is an unexamined default (the routes predate ADR 0026: commit 14cd3bb), not intent.
- **Consumers over HTTP** (`grep travel/places` in `src`, `tests`): only `src/components/planner/trip-editor/trip-editor.tsx:62`, typed `CatalogPlace` (`activity-form.tsx:11-16`) and using `slug`, `name`, `suggestedMinutes`, `estimatedCostVnd` — all in the allow-list. Tests: `tests/places-search.test.ts:85-96` (reads `count`/slugs). No in-repo reader of `affiliateLinks`, `createdAt`, `updatedAt` or `coords` through these endpoints. External clients: unknown (none documented; cannot be ruled out).
- **Current risk is low but real:** seed has `affiliateLinks: []` for every place (`src/content/travel/seed-places.ts:44`, one literal; no partner programme). Today the public leak is empty arrays plus timestamps (minor information disclosure: edit times). Risk grows the day an editor adds partner links (admin schema allows ≤10 per place, `schemas.ts:186`): they would be public via API though hidden on the pages, and the link/partner list is commercial data. `coords` is also in the raw record and not in the allow-list.

## Recommended option (A) — needs the owner's explicit approval before any code
Switch both public routes to `PublicPlace` (reuse `toPublicPlace`, moved to a shared module, e.g. `src/server/content/public-place-projection.ts`, re-exported/used by `public-places.ts`). Response envelope unchanged (`{ places, count }`; detail returns the object).
- **Behaviour change (breaking only for an external client that reads the removed fields):** removed from public JSON: `affiliateLinks`, `createdAt`, `updatedAt`, **`coords`** (also absent from the page allow-list). Kept: `slug`, `name`, `destinationSlug`, `location`, `category`, `images`, `description`, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`.
- Sub-decision for the owner: keep `coords` in the API (add it to `PublicPlace`, a future map needs it; the Planner map is deferred, so not needed now) **or** drop it. Recommendation: drop now, add back with the map's own contract.
- Admin routes unchanged.

Alternative (B) — intentional: keep the raw record; edit docs only (state that the public API returns the full record incl. affiliate links and timestamps, and why). Not recommended: it documents a leak, and affiliate links are meant to be revealed only through a deliberate surface.
Alternative (C) — keep `coords`: as A but `PublicPlace` gains `coords`; page output unchanged because pages pick fields. Smaller break, still removes the sensitive fields.

## Interface contract (option A)
`GET /api/travel/places` → `{ places: PublicPlace[], count }`; `GET /api/travel/places/[slug]` → `PublicPlace` (404 `not_found` unchanged). Query/paging/`q` unchanged. Same status codes, `Cache-Control` and error envelope.

## Tasks by owner (single agent, in sequence)
Architect: this contract + ADR 0026 amendment. BE: shared projection module, two route edits, tests. FE: none. Docs: `docs/travel-content-api.*` (public section: field list, note of removal "since PLACES-API-PROJ"), `docs/features/places.*`, ADR 0026 `.md` + `.vi.md` amendment. No new feature document (fix to existing feature; `places.md` updated).

## Acceptance / tests
- List and detail route tests: response has none of `affiliateLinks`, `createdAt`, `updatedAt`, `coords` (seed a place with a non-empty `affiliateLinks` to prove it is stripped); retained fields equal the stored values; `count` correct.
- Unchanged: `q`, `destinationSlug`, `category`, `limit`/`offset` results (existing `places-search.test.ts` still passes); unknown slug 404; admin GET still returns the full record (`travel-content-api.test.ts`).
- `public-places.ts` pages still project identically (`places-page.test.ts`); trip editor fields still present (type-level: `CatalogPlace` ⊂ `PublicPlace`).
- `typecheck`, `lint`, `test` (incl. `docs.test.ts`), `build` — output stated.

## Risks / rollback
- Only break: an external consumer relying on removed fields (none known in repo or docs). Mitigate: owner confirms no outside client. No data/migration change; rollback = revert the PR.
- Overlap: `gh pr list --state open` (2026-11-19) shows only #175 (docs roadmap sync), touching no places route or `public-places.ts`. The parallel session `places-load-hardening` works around `public-places.ts`; if it edits that file, moving `toPublicPlace` out conflicts — to be coordinated with the owner before implementing (alternative: export `toPublicPlace` from `public-places.ts` without moving it, zero conflict, recommended).
- Security: `/sec-check` recommended after implementation (public data exposure); `/qc-check` optional. Both NOT RUN.
- Budget: subagents 0.
- State: DONE (merged PR #185, 2026-11-19)
- Feature document owner: backend (updates `docs/features/places.md` + `.vi.md`).
- Architecture/usage docs: `docs/architecture.*` only if it describes the public places payload (check at implementation).
