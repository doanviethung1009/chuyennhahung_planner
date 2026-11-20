# ADR 0026 — Public Places routes: `/dia-diem/[slug]` and `/places/[slug]`, every catalogue place is public

🇻🇳 Bản tiếng Việt: [0026-public-places-routes.vi.md](0026-public-places-routes.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-18
- **Owner:** system-architect
- **Affects:** `src/i18n/routing.ts` (one pathname), a new `src/app/[locale]/places/[slug]/page.tsx`, a new read module `src/server/content/public-places.ts`, `src/app/[locale]/destinations/[slug]/page.tsx`, `src/app/sitemap.ts`, `messages/*.json`. No database, API or migration change. Task Contract `PLACES-UI-S1`.

## Context

Places exist in the content repository and in `GET /api/travel/places`, and travellers can review them ([ADR 0014](0014-community-trips-and-reviews.md)), but no public page shows a place. Route topology is a rule that needs an ADR ([architecture.md](../architecture.md) sets the pattern: English internal pathname, per-locale URL).

Facts from the code: a place has no publish or archive state (`publishStatusSchema` applies to stories and collections only); a place carries `affiliateLinks` and timestamps that are not for display; `images` is a list of URLs with no alt text.

## Decision

1. **URLs.** Internal `/places/[slug]`; Vietnamese `/dia-diem/[slug]` (unprefixed), English `/en/places/[slug]`. The slug is the catalogue slug, which is permanent. There is no public places index in this step: places are listed on their destination page (`/destinations/[slug]`).
2. **Every place in the catalogue is public.** There is no draft state to filter on; removing a place from the catalogue removes its page (404).
3. **Read path.** Pages read through `src/server/content/public-places.ts`, which projects a place to an allow-list (no `affiliateLinks`, no timestamps). A listing failure yields an empty list, so the destination page hides the section; the detail page lets a store failure surface as an error rather than a false 404. An unknown slug is a 404.
4. **Images.** The schema has no alt text, so photos carry an alt built from the place name and the photo number, in the page language. Cards use a decorative image next to the name.
5. **Reviews are read-only here.** The page reuses `getApprovedReviews` and `ReviewList`. The review form belongs to a later contract.
6. **Rendering.** `force-dynamic`, like every page that reads Travel content ([ADR 0012](0012-public-travel-from-content-repository.md)); the sitemap lists each place with its `hreflang` alternates.

## Consequences

- One new permanent route pair; changing it later needs a superseding ADR.
- A place seeded as a placeholder becomes publicly visible; the owner reviews catalogue content before launch.
- Alt text is generic until the schema gains per-image alt text (a separate change).

## Amendment — list route (PLACES-UI-S6, 2026-11-19)

The "no places index" consequence no longer holds: `/places` (`/dia-diem`, `/en/places`) is a second permanent route, a searchable and filterable list. Decisions 7 and 8 of the core-completion index: `GET /api/travel/places` gains an optional, backward-compatible `q` (trimmed, 1–80 characters, plain case- and diacritic-insensitive substring match on name and location, run before paging; no pattern built from input). The list is indexable only unfiltered on page 1; other states are `noindex, follow` with the canonical on `/places`. The public projection is still the allow-list. Details: [places.md](../features/places.md). Numbering unchanged.

## Amendment — public API projection (PLACES-API-PROJ, 2026-11-19)

The allow-list in decision 3 now also binds the public API: `GET /api/travel/places` and `/[slug]` return `PublicPlace` (via `toPublicPlace`), so `affiliateLinks`, `createdAt`, `updatedAt` and `coords` are not served publicly. Before, both routes returned the stored record by default, never by a documented decision; no in-repo client read the removed fields. The change is breaking only for an external client that did. Admin routes are unchanged. `coords` returns to the public shape with the Planner map's own contract. Numbering unchanged.
