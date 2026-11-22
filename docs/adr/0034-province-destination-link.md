# ADR 0034 — Link the 34 provinces to destinations through `Destination.provinceSlug`

🇻🇳 Bản tiếng Việt: [0034-province-destination-link.vi.md](0034-province-destination-link.vi.md)

- **Status:** Accepted
- **Date:** 2026-11-22
- **Owner:** system-architect
- **Affects:** `src/content/types.ts` (`Destination.provinceSlug`), `src/content/destinations.ts`, `src/content/provinces.ts`, `src/server/content/public-places.ts`, `src/app/[locale]/places/page.tsx`, `src/app/[locale]/destinations/page.tsx`, `tests/provinces.test.ts`, `docs/features/vietnam-provinces.*`

This ADR records a decision the code already carries: the 34-province reference data (feature document `vietnam-provinces`) was merged in PR #222, and the destination link plus the `/places` and `/destinations` province filters followed in PRs #225 and #228 without an ADR. [`vietnam-provinces.md`](../features/vietnam-provinces.md) said a link "needs its own decision". The owner accepted it on 2026-11-22. Acceptance covers the link design only; the accuracy of the province data is still unverified (see Follow-up).

## Context

The site has two geographic vocabularies. A `Destination` is an editorial unit: 16 entries in `src/content/destinations.ts`, a static file (not a database table), referenced by slug from places, stories, collections, reviews and trips. [ADR 0001](0001-travel-content-system.md) calls it province- or region-scale. A `Province` is an administrative unit: since the 2025 merger there are 34 (6 cities and 28 provinces), kept in `src/content/provinces.ts` with `formerNames` for the 63 units they replaced.

Visitors ask "what is in Lâm Đồng" in administrative terms, and the merger moved boundaries under names people still use: Hà Giang is now inside Tuyên Quang, Hội An inside Đà Nẵng, Quy Nhơn inside Gia Lai. `Destination.area` is deliberately geographic ("survives province reorganisations") and cannot answer that. Without a link, a province filter would need free text or a second hand-kept list.

What the code does today, and what is open:

- `Destination.provinceSlug` is a required, single-valued slug. Every destination carries one.
- A place has no province of its own. It gets one through `place.destinationSlug`; `src/server/content/public-places.ts` resolves a province filter with `destinationSlugsInProvince()`.
- A story with `destinationSlug: null` ([ADR 0012](0012-public-travel-from-content-repository.md)) therefore has no province.
- Trips, templates, collections and the member map ([ADR 0029](0029-member-map.md)) still key on destination slugs, so they are untouched.
- Nothing is stored in PostgreSQL or the JSON content store; the link lives in static files, so there is no migration.
- The coordinates and merger lists in `provinces.ts` were written from knowledge, not an official dataset (the feature document says to verify them against Nghị quyết 202/2025/QH15). That is not yet done.

## Decision

1. **A province is attached to a destination, once.** `Destination.provinceSlug` is required and must resolve to a `Province` in `src/content/provinces.ts`. This is the only place a province is stored.
2. **Everything else derives the province** through its destination: places, and anything that already carries a destination slug. No `provinceSlug` field is added to `Place`, `TravelStory`, `Trip`, `TravelTemplate` or any persisted entity.
3. **The reference list stays a static, typed file** with the same standing as `destinations.ts`. It is not moved into the content store and gets no admin CRUD in this decision.
4. **Integrity is a test, not a runtime rule.** `tests/provinces.test.ts` fails the build when a destination's `provinceSlug` does not resolve, and `tests/destinations-province-filter.test.ts` when a filter offers an empty province. This matches the other static reference data in `src/content/**`.
5. **`Destination.area` stays geographic** and is not replaced or derived from the province.
6. **A story with no destination has no province.** It does not appear under a province filter, and we do not add a second link to fix that.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): one `provinceSlug` on `Destination`, derive elsewhere | One place to edit when provinces change. No persisted-data migration. Matches how every other entity already points at a destination | A destination that straddles two provinces cannot be expressed. Places inherit their destination's province even where the place is across a border |
| B: `provinceSlug` on `Place` (and story) as well | Place-level accuracy | Stored copies that drift from the destination. A content migration and an admin field. The next merger needs editing on every place |
| C: `provinceSlugs` array on `Destination` | Handles a destination spanning provinces | A multi-value filter, ambiguous counts and "which province is it in" no longer has one answer. No current destination needs it |
| D: replace `Destination` with `Province` | One vocabulary | Destinations are an editorial brand unit with their own URLs and content; a 2025-style merger would then rename or merge public pages |

The runner-up is C. It lost because no existing destination spans two provinces, and a multi-value link makes every filter and count ambiguous for a case that does not exist yet.

## Consequences

Easier: a province page or filter is a lookup, not a data project. A reorganisation is one edit per affected destination plus `provinces.ts`, with no data migration. The change is reversible: remove the field and the filters, and no stored data changes.

Harder:

- A destination can only be in one province. A real future entry that spans two (a region-scale destination such as a delta) forces a choice. Revisit option C then.
- Place accuracy is bounded by its destination. A place on the far side of a provincial border is filed under the wrong province.
- Integrity is only enforced at build time. A runtime content editor cannot create an invalid link today because destinations are not editable there; that stops being true the day destinations move into the content store, and this decision would need revisiting with it.
- The accuracy of the province data is unverified (see Context). A wrong `formerNames` entry or coordinate is shown to visitors through the filters.
- A story with no destination is invisible to province filters.

## Follow-up

- Owner: the merger lists and city/province kinds were checked against Nghị quyết 202/2025/QH15 on 2026-11-23 (see `docs/features/vietnam-provinces.md`). Coordinates and region grouping are still unverified.
- Documents: add a short province note to `docs/architecture.md` + `.vi.md` data section. `docs/features/vietnam-provinces.*` should link here instead of saying the link "needs its own decision".
- Not part of this decision, and each needs its own: a province-level member map (ADR 0029 is country level), moving destinations into the content store, or a `provinceSlug` on trips.
