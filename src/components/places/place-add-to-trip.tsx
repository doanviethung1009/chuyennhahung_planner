'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/format';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api, goToSignIn, signInUrl } from '@/components/planner/api';
import { Field, inputClass } from '@/components/planner/field';
import {
  activityBody,
  dayStates,
  tripsForPlace,
  type AddablePlace,
  type TripChoice,
  type TripSnapshot,
} from './add-to-trip-logic';

type Mode = 'loading' | 'guest' | 'member';
type Message = { tone: 'status' | 'alert'; text: string; tripId?: string } | null;

/**
 * "Add to a trip" for one place page (PLACES-UI-S3). The session is read from
 * `GET /api/planner/session` like the review block; the server stays the judge
 * of ownership. A visitor with no session gets a real sign-in link that returns
 * here, never a dead button.
 */
export function PlaceAddToTrip({ place }: { place: AddablePlace & { name: string } }) {
  const t = useTranslations('places.addToTrip');
  const locale = useLocale() as Locale;
  const panelId = useId();
  const [mode, setMode] = useState<Mode>('loading');
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripChoice[] | null>(null);
  const [tripId, setTripId] = useState('');
  const [snapshot, setSnapshot] = useState<TripSnapshot | null>(null);
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [signInHref, setSignInHref] = useState('');
  // Latest trip the user picked; a slow answer for an earlier pick must not overwrite it.
  const latestTrip = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api('/api/planner/session');
        if (!cancelled) setMode('member');
      } catch {
        // 401 or any failure: show the sign-in link; the server decides on submit.
        if (!cancelled) {
          setSignInHref(signInUrl(locale));
          setMode('guest');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function loadTrips(keepMessage = false) {
    setTrips(null);
    if (!keepMessage) setMessage(null);
    try {
      const data = await api<{ trips: TripChoice[] }>(
        `/api/planner?destinationSlug=${encodeURIComponent(place.destinationSlug)}`,
      );
      const usable = tripsForPlace(data.trips, place.destinationSlug);
      setTrips(usable);
      const first = usable[0];
      if (first) await chooseTrip(first.id, { keepMessage });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return goToSignIn(locale);
      setTrips([]);
      setMessage({ tone: 'alert', text: t('errors.load') });
    }
  }

  async function chooseTrip(id: string, options: { keepMessage?: boolean; keepDay?: boolean } = {}) {
    latestTrip.current = id;
    setTripId(id);
    setSnapshot(null);
    if (!options.keepDay) setDay(1);
    if (!options.keepMessage) setMessage(null);
    try {
      const view = await api<TripSnapshot>(`/api/planner/${encodeURIComponent(id)}`);
      if (latestTrip.current === id) setSnapshot(view);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return goToSignIn(locale);
      // Not fatal: without the snapshot only the duplicate/full hints are missing.
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && trips === null) void loadTrips();
  }

  const trip = trips?.find((row) => row.id === tripId) ?? null;
  const days = trip ? dayStates(trip, snapshot, place.slug) : [];
  const chosen = days.find((row) => row.dayNumber === day);

  async function add() {
    if (!trip || busy || chosen?.full) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/planner/${encodeURIComponent(trip.id)}/activities`, {
        method: 'POST',
        body: activityBody(place, day),
      });
      setMessage({ tone: 'status', text: t('success', { trip: trip.title, day }), tripId: trip.id });
      await chooseTrip(trip.id, { keepMessage: true, keepDay: true });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return goToSignIn(locale);
      if (failure instanceof ApiError && failure.status === 404) {
        setMessage({ tone: 'alert', text: t('errors.gone') });
        void loadTrips(true);
      } else if (failure instanceof ApiError && failure.status === 409) {
        setMessage({ tone: 'alert', text: t('errors.unavailable') });
        void chooseTrip(trip.id, { keepMessage: true, keepDay: true });
      } else if (failure instanceof ApiError && failure.status === 429) {
        setMessage({ tone: 'alert', text: t('errors.rateLimited') });
      } else {
        setMessage({ tone: 'alert', text: t('errors.generic') });
      }
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') {
    return (
      <p role="status" className="mt-6 text-sm text-foreground-muted">
        {t('loading')}
      </p>
    );
  }

  if (mode === 'guest') {
    return (
      <div className="mt-6">
        <a href={signInHref} className={buttonClass({ size: 'md', variant: 'secondary' })}>
          {t('signIn')}
        </a>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className={buttonClass({ size: 'md' })}
        onClick={toggle}
      >
        {t('button')}
      </button>

      {open ? (
        <div id={panelId} className="mt-4 max-w-xl rounded-2xl border border-border-subtle bg-surface-muted p-5">
          <h2 className="font-display text-xl font-semibold">{t('title', { name: place.name })}</h2>

          {trips === null ? (
            <p role="status" className="mt-3 text-sm text-foreground-muted">
              {t('loadingTrips')}
            </p>
          ) : trips.length === 0 ? (
            <div className="mt-3 grid gap-3">
              <p className="text-base">{t('noTrips')}</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/my-trips/new" className={buttonClass({ size: 'sm' })}>
                  {t('createTrip')}
                </Link>
                <Link href="/my-trips" className={buttonClass({ size: 'sm', variant: 'secondary' })}>
                  {t('myTrips')}
                </Link>
              </div>
            </div>
          ) : (
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void add();
              }}
            >
              <Field id={`${panelId}-trip`} label={t('tripLabel')}>
                <select
                  id={`${panelId}-trip`}
                  disabled={busy}
                  className={inputClass}
                  value={tripId}
                  onChange={(event) => void chooseTrip(event.target.value)}
                >
                  {trips.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id={`${panelId}-day`} label={t('dayLabel')}>
                <select
                  id={`${panelId}-day`}
                  disabled={busy}
                  className={inputClass}
                  value={day}
                  onChange={(event) => setDay(Number(event.target.value))}
                >
                  {days.map((row) => {
                    const date = trip?.startDate ? addDays(trip.startDate, row.dayNumber - 1) : null;
                    const label = date
                      ? t('dayOptionDated', { day: row.dayNumber, date: formatDate(date, locale) })
                      : t('dayOption', { day: row.dayNumber });
                    return (
                      <option key={row.dayNumber} value={row.dayNumber} disabled={row.full}>
                        {row.full ? `${label} — ${t('dayFull')}` : label}
                      </option>
                    );
                  })}
                </select>
              </Field>

              {chosen?.hasPlace ? (
                <p role="note" className="text-sm font-medium">
                  {t('duplicate', { day })}
                </p>
              ) : null}

              <div>
                <button type="submit" disabled={busy || !chosen || chosen.full} className={buttonClass({ size: 'md' })}>
                  {busy ? t('adding') : chosen?.hasPlace ? t('addAnyway') : t('add')}
                </button>
              </div>
            </form>
          )}

          {message ? (
            <p
              role={message.tone === 'alert' ? 'alert' : 'status'}
              className={`mt-4 text-sm ${message.tone === 'alert' ? 'font-medium text-primary-strong' : ''}`}
            >
              {message.text}
              {message.tripId ? (
                <>
                  {' '}
                  <Link
                    href={{ pathname: '/my-trips/[id]', params: { id: message.tripId } }}
                    className="font-medium text-primary-strong underline"
                  >
                    {t('openTrip')}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** `YYYY-MM-DD` plus `n` days, in UTC so it never shifts with the viewer's timezone. */
function addDays(iso: string, n: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
