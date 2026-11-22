'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { Badge, MetaRow } from '@/components/ui/badge';
import { getDestination } from '@/content/destinations';
import { formatDate } from '@/lib/format';
import type { TripView } from '@/server/planner/repository';
import type { PlanningStatus, Trip } from '@/server/planner/schemas';
import { ApiError, api, goToSignIn } from './api';
import { ActionMenu, type ActionMenuSection } from './action-menu';
import { StatusSelect } from './status-select';

type Tab = 'active' | 'archived';

export function MyTrips() {
  const t = useTranslations('myTrips');
  const tVis = useTranslations('visibility');
  const tPlan = useTranslations('planning');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('active');
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (which: Tab) => {
      try {
        const data = await api<{ trips: Trip[] }>(`/api/planner?status=${which}`);
        setTrips(data.trips);
        setLoadFailed(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return goToSignIn(locale);
        setLoadFailed(true);
      }
    },
    [locale],
  );

  useEffect(() => {
    // Data fetching on mount: state is set after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab);
  }, [load, tab]);

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTrips(null);
    setMessage('');
    setFailed(false);
    setConfirmId(null);
    setTab(next);
  }

  async function act(trip: Trip, done: string, call: () => Promise<unknown>, after?: (result: unknown) => void) {
    setBusyId(trip.id);
    setMessage('');
    setFailed(false);
    try {
      const result = await call();
      setMessage(done);
      setConfirmId(null);
      if (after) after(result);
      else await load(tab);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return goToSignIn(locale);
      setFailed(true);
      setMessage(error instanceof ApiError && error.status === 412 ? t('errorStale') : t('errorAction'));
      await load(tab);
    } finally {
      setBusyId(null);
    }
  }

  const path = (trip: Trip) => `/api/planner/${encodeURIComponent(trip.id)}`;

  return (
    <div>
      <p>
        <Link href="/my-trips/new" className={buttonClass({ size: 'md' })}>
          {t('createCta')}
        </Link>
      </p>

      <div role="group" aria-label={t('tabsLabel')} className="mt-6 flex flex-wrap gap-2">
        {(['active', 'archived'] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => switchTab(key)}
            className={buttonClass({ size: 'sm', variant: tab === key ? 'primary' : 'secondary' })}
          >
            {t(key === 'active' ? 'tabActive' : 'tabArchived')}
          </button>
        ))}
      </div>

      <p role="status" className="mt-4 min-h-6 text-sm text-foreground-muted">
        {failed ? '' : message}
      </p>
      {failed ? (
        <p role="alert" className="mt-2 rounded-lg border border-border-strong bg-surface-muted px-4 py-3 text-sm text-primary-strong">
          {message}
        </p>
      ) : null}

      {loadFailed ? (
        <div role="alert" className="mt-4 rounded-xl border border-border-strong bg-surface p-6">
          <p className="text-base text-primary-strong">{t('errorLoad')}</p>
          <button type="button" className={buttonClass({ size: 'md', variant: 'secondary', className: 'mt-4' })} onClick={() => void load(tab)}>
            {t('retry')}
          </button>
        </div>
      ) : trips === null ? (
        <div aria-busy="true" className="mt-4 max-w-3xl rounded-xl border border-border-subtle bg-surface p-5">
          <p className="text-base text-foreground-muted">{t('loading')}</p>
          <div aria-hidden="true" className="mt-4 h-4 w-2/3 animate-pulse rounded-pill bg-surface-muted" />
          <div aria-hidden="true" className="mt-3 h-4 w-1/2 animate-pulse rounded-pill bg-surface-muted" />
        </div>
      ) : trips.length === 0 ? (
        <div className="mt-4 max-w-3xl rounded-xl border border-border-subtle bg-surface p-6">
          <p className="text-base text-foreground-muted">{tab === 'active' ? t('empty') : t('emptyArchived')}</p>
          {tab === 'active' ? (
            <Link href="/stories" className={buttonClass({ size: 'md', className: 'mt-4' })}>
              {t('emptyCta')}
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="mt-4 grid max-w-3xl list-none gap-4 p-0">
          {trips.map((trip) => {
            const busy = busyId === trip.id;
            const destination = getDestination(trip.destinationSlug)?.name[locale] ?? trip.destinationSlug;
            const sections: ActionMenuSection[] = [
              {
                items: [
                  {
                    key: 'duplicate',
                    label: t('duplicate'),
                    onSelect: () =>
                      void act(
                        trip,
                        t('duplicated'),
                        () => api<TripView>(`${path(trip)}/duplicate`, { method: 'POST', body: {} }),
                        (view) => router.push({ pathname: '/my-trips/[id]', params: { id: (view as TripView).trip.id } }),
                      ),
                  },
                  {
                    key: 'archive',
                    label: t('archive'),
                    onSelect: () =>
                      void act(trip, t('archived'), () => api<TripView>(path(trip), { method: 'DELETE', version: trip.version })),
                  },
                ],
              },
            ];
            return (
              <li key={trip.id} className="rounded-xl border border-border-subtle bg-surface">
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-semibold [overflow-wrap:anywhere]">
                      <Link
                        href={{ pathname: '/my-trips/[id]', params: { id: trip.id } }}
                        className="inline-flex min-h-11 items-center text-foreground hover:text-primary-strong"
                      >
                        {trip.title}
                      </Link>
                    </h3>
                    <p className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={trip.planningStatus === 'completed' ? 'accent' : trip.planningStatus === 'planned' ? 'primary' : 'neutral'}>
                        <span className="sr-only">{t('statusLabel')}: </span>
                        {tPlan(trip.planningStatus)}
                      </Badge>
                      <Badge tone="neutral">{tVis(trip.visibility)}</Badge>
                    </p>
                  </div>
                  {tab === 'active' ? (
                    <ActionMenu label={t('menuLabel', { title: trip.title })} sections={sections} disabled={busy} />
                  ) : null}
                </div>

                <MetaRow
                  className="px-5"
                  items={[
                    destination,
                    trip.startDate ? formatDate(trip.startDate, locale) : t('datesOpen'),
                    t('days', { count: trip.durationDays }),
                    t('party', { count: trip.partySize }),
                  ]}
                />

                <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle p-5 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href={{ pathname: '/my-trips/[id]', params: { id: trip.id } }}
                    className={buttonClass({ size: 'md', className: 'w-full sm:w-auto' })}
                  >
                    {t('open')}
                    <span className="sr-only">: {trip.title}</span>
                  </Link>
                  {tab === 'active' ? (
                    <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
                      <label htmlFor={`status-${trip.id}`} className="text-sm font-medium">
                        {t('statusLabel')}
                      </label>
                      <StatusSelect
                        id={`status-${trip.id}`}
                        value={trip.planningStatus}
                        disabled={busy}
                        onChange={(next: PlanningStatus) =>
                          act(trip, t('statusSaved'), () =>
                            api<TripView>(path(trip), { method: 'PATCH', body: { planningStatus: next }, version: trip.version }),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className={buttonClass({ size: 'md', variant: 'secondary', className: 'w-full sm:w-auto' })}
                        onClick={() =>
                          act(trip, t('restored'), () => api<TripView>(`${path(trip)}/restore`, { method: 'POST', version: trip.version }))
                        }
                      >
                        {t('restore')}
                      </button>
                      {confirmId === trip.id ? (
                        <div
                          role="group"
                          aria-label={t('purgeConfirmLabel', { title: trip.title })}
                          className="flex flex-col gap-3 sm:flex-row sm:items-center"
                        >
                          <p className="text-sm text-primary-strong">{t('purgeConfirm')}</p>
                          <button
                            type="button"
                            disabled={busy}
                            className={buttonClass({ size: 'sm', variant: 'secondary' })}
                            onClick={() =>
                              act(trip, t('purged'), () => api(`${path(trip)}?purge=true`, { method: 'DELETE', version: trip.version }))
                            }
                          >
                            {t('purgeYes')}
                          </button>
                          <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' })} onClick={() => setConfirmId(null)}>
                            {t('purgeNo')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonClass({ size: 'md', variant: 'secondary', className: 'w-full sm:w-auto' })}
                          onClick={() => setConfirmId(trip.id)}
                        >
                          {t('purge')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
