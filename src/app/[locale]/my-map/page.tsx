import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { MemberMapView } from '@/components/map/member-map-view';
import { getMemberMap } from '@/server/planner/member-map';

type Params = { params: Promise<{ locale: Locale }> };

/** Reads the session cookie, so every request is dynamic and answered private (ADR 0029). */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'memberMap' });
  return {
    ...buildPageMetadata({
      href: '/my-map',
      locale,
      title: t('title'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function MyMapPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('memberMap');
  const state = await getMemberMap(new Set(destinations.map((destination) => destination.slug)));

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <MemberMapView state={state} locale={locale} />
      </Container>
    </>
  );
}
