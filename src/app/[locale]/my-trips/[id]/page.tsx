import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { TripDetail } from '@/components/planner/trip-detail';

type Params = { params: Promise<{ locale: Locale; id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'tripDetail' });
  return {
    ...buildPageMetadata({
      href: { pathname: '/my-trips/[id]', params: { id } },
      locale,
      title: t('metaTitle'),
      description: t('metaDescription'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function TripDetailPage({ params }: Params) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <TripDetail id={id} />;
}
