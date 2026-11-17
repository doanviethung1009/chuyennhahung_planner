'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { PlaceRef } from '@/server/planner/schemas';

/** The place's name in the admin's language: its public destination page when the catalogue knows it, else the raw slug as text. */
export function placeLabel(place: PlaceRef | null, slug: string, locale: Locale): string {
  return place?.name[locale] || slug;
}

export function PlaceLink({ place, slug }: { place: PlaceRef | null; slug: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('adminCommunity');
  if (!place) return <span className="break-all">{slug}</span>;
  return (
    <Link
      href={{ pathname: '/destinations/[slug]', params: { slug: place.destinationSlug } }}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4"
    >
      {placeLabel(place, slug, locale)}
      <span className="sr-only"> {t('newTab')}</span>
    </Link>
  );
}
