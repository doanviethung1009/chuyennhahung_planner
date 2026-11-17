import { defineRouting } from 'next-intl/routing';

export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'vi';

/**
 * Canonical (internal) pathnames are English and map 1:1 to the `app/[locale]`
 * folder structure. The per-locale values are the URLs the visitor actually sees.
 *
 * Vietnamese is the default locale and renders unprefixed (`/chuyen-di-choi`),
 * English is prefixed (`/en/stories`).
 */
export const pathnames = {
  '/': '/',
  '/stories': { vi: '/chuyen-di-choi', en: '/stories' },
  '/stories/[slug]': { vi: '/chuyen-di-choi/[slug]', en: '/stories/[slug]' },
  '/destinations': { vi: '/kham-pha', en: '/destinations' },
  '/destinations/[slug]': { vi: '/kham-pha/[slug]', en: '/destinations/[slug]' },
  '/places/[slug]': { vi: '/dia-diem/[slug]', en: '/places/[slug]' },
  '/map': { vi: '/ban-do', en: '/map' },
  '/itineraries': { vi: '/len-lich-trinh', en: '/itineraries' },
  '/itineraries/[slug]': { vi: '/len-lich-trinh/[slug]', en: '/itineraries/[slug]' },
  '/plan-your-trip': { vi: '/thiet-ke-chuyen-di', en: '/plan-your-trip' },
  '/trip-setup/[template]': { vi: '/tao-chuyen-di/[template]', en: '/trip-setup/[template]' },
  '/sign-in': { vi: '/dang-nhap', en: '/sign-in' },
  '/account/password': { vi: '/doi-mat-khau', en: '/account/password' },
  '/my-trips': { vi: '/chuyen-di-cua-toi', en: '/my-trips' },
  '/my-trips/new': { vi: '/chuyen-di-cua-toi/moi', en: '/my-trips/new' },
  '/my-trips/[id]': { vi: '/chuyen-di-cua-toi/[id]', en: '/my-trips/[id]' },
  '/shared/[token]': { vi: '/chia-se/[token]', en: '/shared/[token]' },
  '/reviews': { vi: '/goc-review', en: '/reviews' },
  '/community-trips': { vi: '/chuyen-di-cong-dong', en: '/community-trips' },
  '/admin': { vi: '/quan-tri', en: '/admin' },
  '/admin/content/stories': { vi: '/quan-tri/noi-dung/chuyen-di', en: '/admin/content/stories' },
  '/admin/content/stories/new': { vi: '/quan-tri/noi-dung/chuyen-di/moi', en: '/admin/content/stories/new' },
  '/admin/content/stories/[slug]': {
    vi: '/quan-tri/noi-dung/chuyen-di/[slug]',
    en: '/admin/content/stories/[slug]',
  },
  '/admin/content/places': { vi: '/quan-tri/noi-dung/dia-diem', en: '/admin/content/places' },
  '/admin/content/places/new': { vi: '/quan-tri/noi-dung/dia-diem/moi', en: '/admin/content/places/new' },
  '/admin/content/places/[slug]': {
    vi: '/quan-tri/noi-dung/dia-diem/[slug]',
    en: '/admin/content/places/[slug]',
  },
  '/admin/content/reviews': { vi: '/quan-tri/noi-dung/danh-gia', en: '/admin/content/reviews' },
  '/admin/users': { vi: '/quan-tri/nguoi-dung', en: '/admin/users' },
  '/admin/community': { vi: '/quan-tri/cong-dong', en: '/admin/community' },
  '/admin/runbook': { vi: '/quan-tri/runbook', en: '/admin/runbook' },
  '/about': { vi: '/ve-nha-hung', en: '/about' },
} as const;

export type AppPathname = keyof typeof pathnames;

/**
 * Pathnames with no dynamic segment. `next-intl`'s `Link` accepts these as a
 * bare string, whereas a `[slug]` route must be passed as `{ pathname, params }`.
 * Navigation constants use this so a dynamic route can never be listed as a
 * plain menu entry.
 */
export type StaticPathname = {
  [K in AppPathname]: K extends `${string}[${string}` ? never : K;
}[AppPathname];

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  /**
   * Off deliberately. The audience is ~80% Vietnamese, and Accept-Language
   * would hand a Vietnamese visitor with an English-configured browser or
   * phone an English page. `/` is always Vietnamese; English is an explicit
   * choice via the locale switcher or a `/en` link.
   */
  localeDetection: false,
  pathnames,
});
