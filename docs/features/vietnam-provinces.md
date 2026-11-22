# Feature — Vietnam provinces

🇻🇳 Bản tiếng Việt: [vietnam-provinces.vi.md](vietnam-provinces.vi.md)

## Summary

A typed reference list of all 34 first-level administrative units of Vietnam
(6 cities and 28 provinces) after the 2025 merger. It is the data foundation for
anything that needs to say "which province" — it is not shown in the UI yet.

## Routes

None.

## Data

`provinces` in [`src/content/provinces.ts`](../../src/content/provinces.ts), type
`Province` in `src/content/types.ts`: `slug`, `name` (vi/en), `kind`, `region`,
`coords` and `formerNames`. `coords` is a representative city point to 2 decimals,
not a boundary or centre. `formerNames` lists the 63 pre-2025 units merged in.

## How it works

Static typed data plus `getProvince(slug)`. Each `Destination` carries a
`provinceSlug`; the `/places` province filter uses it (see [places.md](places.md)).
`Destination.area` stays geographic on purpose.

## Files

| Path | Role |
|---|---|
| `src/content/types.ts` | `Province` type |
| `src/content/provinces.ts` | the 34 units and `getProvince` |
| `tests/provinces.test.ts` | count and integrity checks |

## Tests

`tests/provinces.test.ts`: 34 units (6 cities), unique slugs, the 63 former units
each appear once, names in both locales, coordinates inside Vietnam's bounds.

## Limits and open questions

**Verified (2026-11-23):** the 34 units, which are cities and which provinces, and
every unit's `formerNames` match Điều 1 of Nghị quyết 202/2025/QH15 (23 merged
units and 11 unchanged; 63 former units, each exactly once), compared by script.
The text came from a secondary copy on luatvietnam.vn, not the official gazette.
`Huế` carries `Thừa Thiên Huế` as its former name; the resolution only says the
unit is unchanged, so that name comes from the earlier rename, not from it.

**Not verified:** coordinates (the resolution has none; a representative city
point to 2 decimals, not checked per unit), the north/central/south grouping
(the traditional split, not in the resolution) and the slugs. No districts or
wards. A future
link from trips or stories to provinces, or a province in the member map, needs its own decision. The destination link is decided in [ADR 0034](../adr/0034-province-destination-link.md).
