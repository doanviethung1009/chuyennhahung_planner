import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { contribution } from '@/content/site';
import { loadCommunityTrips } from '@/server/community/public';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { CommunityTripCard } from '@/components/cards/community-trip-card';
import { ButtonLink } from '@/components/ui/button';
import { StateNotice } from '@/components/ui/state-notice';

/** Approved listings change at any time: rendered per request (ADR 0014). */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'community' });
  return buildPageMetadata({
    href: '/community-trips',
    locale,
    title: t('metaTitle'),
    description: t('description'),
  });
}

export default async function CommunityTripsPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tStates, result] = await Promise.all([
    getTranslations('community'),
    getTranslations('states'),
    loadCommunityTrips(48),
  ]);
  const trips = result.ok ? result.trips : [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={trips.length > 0 ? <p className="text-sm text-foreground-muted">{t('count', { count: trips.length })}</p> : null}
      />
      <Container width="wide">
        <div className="py-12 md:py-16">
          {!result.ok ? (
            <StateNotice tone="error" title={t('errorTitle')} body={t('errorBody')}>
              <ButtonLink href="/community-trips" variant="secondary">
                {tStates('retry')}
              </ButtonLink>
            </StateNotice>
          ) : trips.length === 0 ? (
            <p className="text-lg text-foreground-muted">{t('empty')}</p>
          ) : (
            <ul className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <li key={trip.shareToken}>
                  <CommunityTripCard trip={trip} locale={locale} />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-10 max-w-2xl text-sm text-foreground-muted">{t('moderationNote')}</p>
          {contribution.takedownContact ? (
            <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
              {t('takedown')}{' '}
              <a
                href={`mailto:${contribution.takedownContact}`}
                className="font-medium text-primary-strong underline underline-offset-4"
              >
                {contribution.takedownContact}
              </a>
            </p>
          ) : null}
        </div>
      </Container>
    </>
  );
}
