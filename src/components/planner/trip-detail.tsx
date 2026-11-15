'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { getDestination } from '@/content/destinations';
import { formatDate, formatVnd } from '@/lib/format';
import type { TripView } from '@/server/planner/repository';
import type { PlanningStatus } from '@/server/planner/schemas';
import { ApiError, api, goToSignIn } from './api';
import { SharePanel } from './share-panel';
import { PlaceReviewsPanel } from '@/components/reviews/place-reviews-panel';
import { StatusSelect } from './status-select';
import { TripEditor } from './trip-editor/trip-editor';

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; view: TripView };

export function TripDetail({ id }: { id: string }) {
  const t = useTranslations('tripDetail');
  const tStyle = useTranslations('travelStyle');
  const tPace = useTranslations('pace');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [pageBusy, setBusy] = useState(false);
  // An editor write in flight locks this page's own actions too: both use the same trip version.
  const [editorBusy, setEditorBusy] = useState(false);
  const busy = pageBusy || editorBusy;
  const [message, setMessage] = useState('');

  const path = `/api/planner/${encodeURIComponent(id)}`;

  const fetchTrip = useCallback(async () => {
    try {
      setLoad({ state: 'ready', view: await api<TripView>(`/api/planner/${encodeURIComponent(id)}`) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return goToSignIn(locale);
      setLoad({ state: error instanceof ApiError && error.status === 404 ? 'missing' : 'error' });
    }
  }, [id, locale]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTrip();
  }, [fetchTrip]);

  if (load.state !== 'ready') {
    return (
      <>
        <PageHeader title={load.state === 'loading' ? t('loadingTitle') : t('missingTitle')} />
        <Container width="default">
          <div className="py-10">
            <p className="text-base text-foreground-muted">
              {load.state === 'loading' ? t('loading') : load.state === 'missing' ? t('missing') : t('error')}
            </p>
            <Link href="/my-trips" className={buttonClass({ variant: 'secondary', className: 'mt-6' })}>
              {t('back')}
            </Link>
          </div>
        </Container>
      </>
    );
  }

  const { trip, days, budget } = load.view;
  const destination = getDestination(trip.destinationSlug)?.name[locale] ?? trip.destinationSlug;
  const story = trip.sourceTemplate?.story ?? null;
  const archived = trip.status === 'archived';

  async function run(done: string, call: () => Promise<unknown>, after?: (r: unknown) => void) {
    setBusy(true);
    setMessage('');
    try {
      const result = await call();
      setMessage(done);
      if (after) after(result);
      else await fetchTrip();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return goToSignIn(locale);
      setMessage(error instanceof ApiError && error.status === 412 ? t('errorStale') : t('errorAction'));
      await fetchTrip();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={destination}
        title={trip.title}
        meta={
          <p className="text-base text-foreground-muted">
            {trip.startDate ? formatDate(trip.startDate, locale) : t('datesOpen')} · {t('days', { count: trip.durationDays })} ·{' '}
            {t('party', { count: trip.partySize })}
          </p>
        }
      />
      <Container width="default">
        <div className="grid gap-10 py-10 md:py-14">
          <Link href="/my-trips" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-strong">
            <span aria-hidden="true">←</span>
            {t('back')}
          </Link>

          {archived ? <p className="rounded-md bg-surface-muted p-4 text-base">{t('archivedNote')}</p> : null}

          <section aria-labelledby="detail-summary" className="grid gap-4">
            <h2 id="detail-summary" className="font-display text-2xl font-semibold">
              {t('summary')}
            </h2>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row label={t('budgetTarget')} value={formatVnd(budget.targetTotalVnd, locale)} />
              <Row label={t('budgetEstimated')} value={formatVnd(budget.estimatedTotalVnd, locale)} />
              <Row label={t('budgetActual')} value={formatVnd(budget.actualTotalVnd, locale)} />
              <Row label={t('budgetProjected')} value={formatVnd(budget.projectedTotalVnd, locale)} />
              {budget.overrunVnd > 0 ? (
                <>
                  <Row label={t('overrunTotal')} value={formatVnd(budget.overrunVnd, locale)} />
                  <Row label={t('overrunPerPerson')} value={formatVnd(budget.perPerson.overrunVnd, locale)} />
                </>
              ) : null}
              {trip.travelStyle ? <Row label={t('travelStyle')} value={tStyle(trip.travelStyle)} /> : null}
              {trip.pace ? <Row label={t('pace')} value={tPace(trip.pace)} /> : null}
              {trip.note ? <Row label={t('note')} value={trip.note} /> : null}
            </dl>
            {story ? (
              <p className="text-base text-foreground-muted">
                {t('basedOn')}{' '}
                <Link
                  href={{ pathname: '/stories/[slug]', params: { slug: story.slug } }}
                  className="font-medium text-primary-strong underline underline-offset-4"
                >
                  {story.title[locale]}
                </Link>
              </p>
            ) : null}
          </section>

          {!archived ? (
            <section aria-labelledby="detail-manage" className="grid gap-4">
              <h2 id="detail-manage" className="font-display text-2xl font-semibold">
                {t('manage')}
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <label htmlFor="detail-status" className="text-sm font-medium">
                  {t('statusLabel')}
                </label>
                <StatusSelect
                  id="detail-status"
                  value={trip.planningStatus}
                  disabled={busy}
                  onChange={(next: PlanningStatus) =>
                    run(t('statusSaved'), () =>
                      api(path, { method: 'PATCH', body: { planningStatus: next }, version: trip.version }),
                    )
                  }
                />
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass({ size: 'sm', variant: 'secondary' })}
                  onClick={() =>
                    run(
                      t('duplicated'),
                      () => api<TripView>(`${path}/duplicate`, { method: 'POST', body: {} }),
                      (view) => router.push({ pathname: '/my-trips/[id]', params: { id: (view as TripView).trip.id } }),
                    )
                  }
                >
                  {t('duplicate')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass({ size: 'sm', variant: 'secondary' })}
                  onClick={() =>
                    run(t('archived'), () => api(path, { method: 'DELETE', version: trip.version }), () =>
                      router.push('/my-trips'),
                    )
                  }
                >
                  {t('archive')}
                </button>
              </div>
              <p role="status" className="min-h-6 text-sm text-foreground-muted">
                {message}
              </p>
            </section>
          ) : null}

          {archived ? (
            <section aria-labelledby="detail-days" className="grid gap-4">
              <h2 id="detail-days" className="font-display text-2xl font-semibold">
                {t('itinerary')}
              </h2>
              <ol className="grid list-none gap-5 p-0">
                {days.map((day) => (
                  <li key={day.id} className="rounded-xl border border-border-subtle bg-surface p-5 md:p-6">
                    <h3 className="font-display text-lg font-semibold md:text-xl">
                      {day.title ?? t('day', { number: day.dayNumber })}
                    </h3>
                    {day.date ? <p className="mt-1 text-sm text-foreground-muted">{formatDate(day.date, locale)}</p> : null}
                    <ul className="mt-4 grid list-none gap-3 p-0">
                      {day.activities.map((activity) => (
                        <li key={activity.id} className="flex gap-4">
                          <span className="w-16 shrink-0 text-sm font-medium text-primary-strong tabular-nums">
                            {activity.startTime ?? t('anytime')}
                          </span>
                          <span>
                            <span className="block text-base">{activity.title}</span>
                            {activity.note ? (
                              <span className="mt-0.5 block text-sm text-foreground-muted">{activity.note}</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <TripEditor
              view={load.view}
              onView={(next) => setLoad({ state: 'ready', view: next })}
              onReload={fetchTrip}
              onUnauthorized={() => goToSignIn(locale)}
              locked={pageBusy}
              onBusyChange={setEditorBusy}
            />
          )}

          {!archived ? <PlaceReviewsPanel view={load.view} onUnauthorized={() => goToSignIn(locale)} /> : null}

          {!archived ? (
            <SharePanel
              tripId={trip.id}
              initial={{
                visibility: trip.visibility,
                shareToken: trip.shareToken,
                shareTokenCreatedAt: trip.shareTokenCreatedAt,
                listing: trip.listing,
              }}
              onUnauthorized={() => goToSignIn(locale)}
            />
          ) : null}
        </div>
      </Container>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-foreground-muted">{label}</dt>
      <dd className="mt-0.5 text-base">{value}</dd>
    </div>
  );
}
