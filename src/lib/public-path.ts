import { pathnames, type Locale } from '@/i18n/routing';

const PUBLIC_ROUTE = {
  stories: '/stories/[slug]',
  places: '/places/[slug]',
} as const;

export type PublicContentKind = keyof typeof PUBLIC_ROUTE;

/**
 * The public URL path a record with this slug will have, built from the
 * localized route map. VI is unprefixed, EN carries `/en` (`localePrefix:
 * 'as-needed'`). Text only: the record does not exist yet.
 */
export function publicContentPath(kind: PublicContentKind, slug: string, locale: Locale): string {
  const entry = pathnames[PUBLIC_ROUTE[kind]];
  const path = entry[locale].replace('[slug]', slug);
  return locale === 'vi' ? path : `/${locale}${path}`;
}
