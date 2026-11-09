import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getDestination } from '@/content/destinations';
import { formatDate, formatVnd } from '@/lib/format';
import { getPlannerRepository } from '@/server/planner/instance';
import type { SharedTripView } from '@/server/planner/schemas';
import { checkShareRead } from '@/server/rate-limit';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { ItineraryDays } from '@/components/planner/itinerary-days';

type Params = { params: Promise<{ locale: Locale; token: string }> };

/** A token is a bearer secret: this page is always rendered per request. */
export const dynamic = 'force-dynamic';

type Loaded = { kind: 'limited' } | { kind: 'missing' } | { kind: 'ok'; trip: SharedTripView };

/**
 * One rate-limit check and one repository read per request, shared by
 * `generateMetadata` and the page through React `cache`, so rendering a page
 * does not spend two units of the visitor's budget.
 */
const load = cache(async (token: string): Promise<Loaded> => {
  const limit = checkShareRead(await headers());
  if (!limit.ok) return { kind: 'limited' };
  const trip = await (await getPlannerRepository()).getSharedTrip(token);
  return trip ? { kind: 'ok', trip } : { kind: 'missing' };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, token } = await params;
  const loaded = await load(token);
  const t = await getTranslations({ locale, namespace: 'shared' });

  // No alternates: a token must not be advertised across locales. No URL or
  // token in the title either.
  if (loaded.kind === 'limited') {
    return { title: t('limitedTitle'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
  }
  if (loaded.kind === 'missing') return { robots: { index: false, follow: false }, referrer: 'no-referrer' };

  const isPublic = loaded.trip.visibility === 'public';
  return {
    title: loaded.trip.title,
    description: t('metaDescription'),
    robots: isPublic ? { index: true, follow: true } : { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function SharedTripPage({ params }: Params) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const loaded = await load(token);
  const t = await getTranslations('shared');

  if (loaded.kind === 'limited') {
    return (
      <PageHeader title={t('limitedTitle')} description={t('limitedBody')} />
    );
  }
  if (loaded.kind === 'missing') notFound();

  const trip = loaded.trip;
  const tStyle = await getTranslations('travelStyle');
  const tPace = await getTranslations('pace');
  const destination = getDestination(trip.destinationSlug)?.name[locale] ?? trip.destinationSlug;
  const story = trip.attribution?.story ?? null;

  const days = trip.days.map((day) => ({
    dayNumber: day.dayNumber,
    title: day.title,
    date: day.date,
    activities: day.activities.map((a) => ({
      title: a.title,
      startTime: a.startTime,
      endTime: a.endTime,
      note: a.note,
    })),
  }));

  return (
    <>
      <PageHeader
        eyebrow={destination}
        title={trip.title}
        description={t('readOnlyNote')}
        meta={
          <p className="text-base text-foreground-muted">
            {trip.startDate ? formatDate(trip.startDate, locale) : t('datesOpen')} ·{' '}
            {t('days', { count: trip.durationDays })} · {t('party', { count: trip.partySize })}
            {trip.travelStyle ? ` · ${tStyle(trip.travelStyle)}` : ''}
            {trip.pace ? ` · ${tPace(trip.pace)}` : ''}
          </p>
        }
      />
      <Container width="default">
        <div className="grid gap-10 py-10 md:py-14">
          <section aria-labelledby="shared-days" className="grid gap-5">
            <h2 id="shared-days" className="font-display text-2xl font-semibold md:text-3xl">
              {t('itinerary')}
            </h2>
            <ItineraryDays days={days} locale={locale} />
          </section>

          <section aria-labelledby="shared-budget" className="rounded-2xl bg-surface-muted p-5 md:p-8">
            <h2 id="shared-budget" className="font-display text-2xl font-semibold">
              {t('budget')}
            </h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {trip.budget.targetTotalVnd !== null ? (
                <div>
                  <dt className="text-sm text-foreground-muted">{t('budgetTarget')}</dt>
                  <dd className="mt-0.5 text-base">{formatVnd(trip.budget.targetTotalVnd, locale)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-sm text-foreground-muted">{t('budgetEstimated')}</dt>
                <dd className="mt-0.5 text-base">{formatVnd(trip.budget.estimatedTotalVnd, locale)}</dd>
              </div>
            </dl>
          </section>

          {story ? (
            <p className="text-base text-foreground-muted">
              {t('basedOn')}{' '}
              <Link
                href={{ pathname: '/stories/[slug]', params: { slug: story.slug } }}
                className="inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4"
              >
                {story.title[locale]}
              </Link>
            </p>
          ) : null}
        </div>
      </Container>
    </>
  );
}
