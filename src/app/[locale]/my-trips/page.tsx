import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { MemberMapView } from '@/components/map/member-map-view';
import { MemberMapSharePanel } from '@/components/map/member-map-share-panel';
import { MemberMapSharePreview } from '@/components/map/member-map-share-preview';
import { MyTrips } from '@/components/planner/my-trips';
import { getMemberMap } from '@/server/planner/member-map';
import { getMemberMapSharePreview } from '@/server/planner/member-map-share-preview';

type Params = { params: Promise<{ locale: Locale }> };

/**
 * The member's home (ADR 0031): the map above the trip list. It reads the
 * session cookie, so every request is dynamic and answered private (ADR 0029).
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'myTrips' });
  return {
    ...buildPageMetadata({
      href: '/my-trips',
      locale,
      title: t('title'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function MyTripsPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('myTrips');
  const knownSlugs = new Set(destinations.map((destination) => destination.slug));
  const state = await getMemberMap(knownSlugs);
  // Only a signed-in member gets the sharing controls and the public preview.
  const sharePoints = state.status === 'guest' ? null : await getMemberMapSharePreview(knownSlugs);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <MemberMapView state={state} locale={locale} />
        {sharePoints ? (
          <div className="pb-12 md:pb-16">
            <MemberMapSharePanel
              preview={<MemberMapSharePreview points={sharePoints} locale={locale} />}
            />
          </div>
        ) : null}
      </Container>
      {/* A guest gets the map's sign-in prompt only: MyTrips would redirect to sign-in on its 401. */}
      {state.status === 'guest' ? null : (
        <Container width="default">
          <section aria-labelledby="my-trips-list" className="pb-10 md:pb-14">
            <h2 id="my-trips-list" className="font-display text-2xl font-semibold md:text-3xl">
              {t('listTitle')}
            </h2>
            <div className="mt-6">
              <MyTrips />
            </div>
          </section>
        </Container>
      )}
    </>
  );
}
