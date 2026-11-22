import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { MemberMapView } from '@/components/map/member-map-view';
import { MemberHomeTabs } from '@/components/planner/member-home-tabs';
import { MemberMapSharePanel } from '@/components/map/member-map-share-panel';
import { MemberMapSharePreview } from '@/components/map/member-map-share-preview';
import { MyTrips } from '@/components/planner/my-trips';
import { parseMemberHomeTab } from '@/lib/member-home-tab';
import { parseTripsView } from '@/lib/trips-view';
import { getMemberMap, getMemberSession } from '@/server/planner/member-map';
import { getMemberMapShareOverview } from '@/server/planner/member-map-share-preview';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tab?: string | string[]; view?: string | string[] }>;
};

/**
 * The member's home (ADR 0031, tabs by ADR 0032): one section at a time, chosen
 * by `?tab=`. It reads the session cookie, so every request is dynamic and
 * answered private (ADR 0029). Each section reads only its own data.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
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

export default async function MyTripsPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('myTrips');
  const query = await searchParams;
  const tab = parseMemberHomeTab(query.tab);
  const view = parseTripsView(query.view);
  const knownSlugs = new Set(destinations.map((destination) => destination.slug));

  // A guest, on any tab, gets the empty map and the sign-in prompt: MyTrips would
  // redirect to sign-in on its 401, and the sharing controls are owner-only.
  const guest = tab === 'map' ? false : !(await getMemberSession());
  const overview = tab === 'share' && !guest ? await getMemberMapShareOverview(knownSlugs) : null;
  if (tab === 'map' || guest || (tab === 'share' && !overview)) {
    const state = await getMemberMap(knownSlugs);
    return (
      <>
        <PageHeader title={t('title')} description={t('description')} />
        <Container width="wide">
          {state.status === 'guest' ? null : <MemberHomeTabs active="map" />}
          <MemberMapView state={state} locale={locale} />
        </Container>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <MemberHomeTabs active={tab} />
        {overview ? (
          <div className="py-10 md:py-12">
            <MemberMapSharePanel
              unfinishedTrips={overview.unfinishedTrips}
              preview={<MemberMapSharePreview points={overview.points} locale={locale} />}
            />
          </div>
        ) : (
          <section aria-labelledby="my-trips-list" className="py-10 md:py-12">
            <h2 id="my-trips-list" className="font-display text-2xl font-semibold md:text-3xl">
              {t('listTitle')}
            </h2>
            <div className="mt-6">
              <MyTrips key={view} view={view} />
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
