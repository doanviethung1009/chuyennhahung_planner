'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TripView } from '@/server/planner/repository';
import { ApiError, api } from '../api';
import type { CatalogPlace } from './activity-form';
import { DayCard } from './day-card';
import { ExpensesPanel } from './expenses-panel';
import { ACTIVITIES_PER_DAY_LIMIT, type Mutate } from './shared';
import { TripFieldsForm } from './trip-fields-form';

/**
 * The owner's editor for an active trip: header, days with their activities,
 * and expenses. Every write goes through `mutate`, which sends the version the
 * page last read and replaces the page's state with the `TripView` the API
 * answers with — so the budget and the next `If-Match` are always current.
 */
export function TripEditor({
  view,
  onView,
  onReload,
  onUnauthorized,
  locked,
  onBusyChange,
}: {
  view: TripView;
  onView: (view: TripView) => void;
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
  /** The page is busy with a write of its own (status, duplicate, archive). */
  locked: boolean;
  /** Tells the page when an editor write is in flight, so it can lock its own controls. */
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations('tripEditor');
  const [writing, setWriting] = useState(false);
  const busy = writing || locked;
  // Bumped on a stale write so the details form restarts from the server's copy.
  const [formEpoch, setFormEpoch] = useState(0);
  const statusRef = useRef<HTMLParagraphElement>(null);
  // A second write with the same version would only come back as a spurious 412.
  const inFlight = useRef(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [places, setPlaces] = useState<CatalogPlace[]>([]);

  const { trip, days } = view;
  const destinationSlug = trip.destinationSlug;
  const fullDays = new Set(days.filter((d) => d.activities.length >= ACTIVITIES_PER_DAY_LIMIT).map((d) => d.dayNumber));

  // The catalog is public and optional: without it an activity is simply self-made.
  useEffect(() => {
    let cancelled = false;
    void api<{ places: CatalogPlace[] }>(
      `/api/travel/places?destinationSlug=${encodeURIComponent(destinationSlug)}&limit=100`,
    )
      .then((data) => {
        if (!cancelled) setPlaces(data.places);
      })
      .catch(() => {
        if (!cancelled) setPlaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [destinationSlug]);

  const mutate: Mutate = useCallback(
    async (done, request, options) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setWriting(true);
      onBusyChange(true);
      setMessage('');
      setFailed(false);
      try {
        onView(await request(trip.version));
        setMessage(done);
        // The delete or close button is gone now; without this focus falls back to <body>.
        if (options?.refocus) setTimeout(() => statusRef.current?.focus(), 0);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
          return false;
        }
        setFailed(true);
        if (error instanceof ApiError && error.status === 412) {
          setMessage(t('errorStale'));
          await onReload();
          // After the reload, so the form is rebuilt from the fresh copy and not the old one.
          setFormEpoch((epoch) => epoch + 1);
        } else if (error instanceof ApiError && error.status === 409) {
          setMessage(options?.conflictMessage ?? t('errorState'));
        } else if (error instanceof ApiError && error.status === 422) {
          setMessage(t('errorValidation'));
        } else {
          setMessage(t('errorGeneric'));
        }
        return false;
      } finally {
        inFlight.current = false;
        setWriting(false);
        onBusyChange(false);
      }
    },
    [trip.version, onView, onReload, onUnauthorized, onBusyChange, t],
  );

  return (
    <>
      <p
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className={`min-h-6 text-sm ${failed ? 'font-medium text-primary-strong' : 'text-foreground-muted'}`}
      >
        {message}
      </p>

      <section aria-labelledby="detail-edit" className="grid gap-4">
        <h2 id="detail-edit" className="font-display text-2xl font-semibold">
          {t('editHeading')}
        </h2>
        <TripFieldsForm key={formEpoch} view={view} busy={busy} mutate={mutate} />
      </section>

      <section aria-labelledby="detail-days" className="grid gap-4">
        <h2 id="detail-days" className="font-display text-2xl font-semibold">
          {t('daysHeading')}
        </h2>
        <ol className="grid list-none gap-5 p-0">
          {days.map((day) => (
            <DayCard
              key={day.id}
              tripId={trip.id}
              day={day}
              dayCount={days.length}
              fullDays={fullDays}
              places={places}
              busy={busy}
              mutate={mutate}
            />
          ))}
        </ol>
      </section>

      <ExpensesPanel view={view} busy={busy} mutate={mutate} />
    </>
  );
}
