# Feature — i18n and routing

🇻🇳 Bản tiếng Việt: [i18n-and-routing.vi.md](i18n-and-routing.vi.md)

## Summary

Vietnamese visitors get Vietnamese URLs with no prefix; English is an explicit
choice at `/en`. This is the feature every other feature sits on: a route that is
not in the pathname map does not exist in either language.

## Routes

Every route in the app, in both locales. See the full table in
[../architecture.md](../architecture.md#routing-and-localization). Locale-independent
routes (`robots.txt`, `sitemap.xml`, `/opengraph-image`) sit outside `[locale]`
and are excluded by the middleware matcher.

## Data

`messages/vi.json` and `messages/en.json` hold every user-visible string, keyed
by namespace (`nav`, `common`, `home`, `plan`, `reviews`, …). The two files are
key-for-key identical by test, including ICU placeholders.

`src/i18n/routing.ts` holds `locales`, `defaultLocale`, and `pathnames` — the
single source of truth for which URL a locale shows.

## How it works

`src/middleware.ts` runs `next-intl`'s middleware over `routing`, mapping an
incoming localized path to the internal pathname that matches the
`app/[locale]` folder. `localePrefix` is `as-needed`, so VI is unprefixed.

`localeDetection` is **off on purpose**: Accept-Language would hand a Vietnamese
visitor with an English-configured phone an English page, which is the wrong
default for an audience that is overwhelmingly Vietnamese. `/` is always
Vietnamese; English is reached through the locale switcher or an `/en` link.

Components import `Link`, `redirect`, `usePathname` and `getPathname` from
`src/i18n/navigation.ts`, never from `next/link` — importing `next/link`
directly bypasses the localized pathname map and emits an internal URL.

Two types enforce correct linking: `AppPathname` (every internal route) and
`StaticPathname`, which excludes `[slug]` routes so a dynamic route can never be
listed as a plain menu entry.

## Files

| Path | Role |
|---|---|
| [`src/i18n/routing.ts`](../../src/i18n/routing.ts) | Locales, default, localized pathname map, route types |
| [`src/i18n/navigation.ts`](../../src/i18n/navigation.ts) | The only legal `Link` / `getPathname` source |
| [`src/i18n/request.ts`](../../src/i18n/request.ts) | Per-request locale + message loading |
| [`src/middleware.ts`](../../src/middleware.ts) | Locale resolution; matcher excludes `/api`, `/_next`, `/opengraph-image`, `*.*` |
| [`messages/vi.json`](../../messages/vi.json), [`messages/en.json`](../../messages/en.json) | String catalogues |
| [`src/components/layout/locale-switcher.tsx`](../../src/components/layout/locale-switcher.tsx) | Switches locale while staying on the same page |

## Tests

- `tests/routing.test.ts` — every pathname defined in every locale, dynamic
  segments identical across locales, no duplicate URL within a locale, VI
  unprefixed, `localeDetection` off, every nav entry points at a real static
  route, six primary nav entries.
- `tests/i18n.test.ts` — identical keys, no empty values, identical ICU
  placeholders, and a canary that fails when a Vietnamese value is copied
  verbatim into English (with a small allow-list for brand names).

## Limits and open questions

Only `vi` and `en` exist. Adding a third locale is three coordinated changes
(`routing.ts`, a new catalogue, every `Localized<T>` field in `src/content/**`)
and the content work dominates — eight destinations, six stories, four
itineraries and six video reviews all have per-locale prose.

Turning locale detection on later would need an ADR; it changes what `/` means
for an existing audience.
