'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api } from '@/components/planner/api';
import { ReviewForm } from './review-form';
import type { OwnReview } from '@/server/planner/schemas';
import type { TripView } from '@/server/planner/repository';

/**
 * Lets a signed-in traveller review the places in their own trip (ADR 0014).
 * Reviews written here wait for staff approval, and the panel shows each one's
 * status. Only places that came from the catalogue appear — a free-text
 * activity has no place to review.
 */
export function PlaceReviewsPanel({
  view,
  onUnauthorized,
}: {
  view: TripView;
  onUnauthorized: () => void;
}) {
  const t = useTranslations('communityReviews');
  const locale = useLocale() as Locale;
  const [own, setOwn] = useState<Record<string, OwnReview> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');

  const places = useMemo(() => {
    const seen = new Map<string, string>();
    for (const day of view.days) {
      for (const activity of day.activities) {
        if (activity.placeSlug && !seen.has(activity.placeSlug)) seen.set(activity.placeSlug, activity.title);
      }
    }
    return [...seen].map(([slug, name]) => ({ slug, name }));
  }, [view.days]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: OwnReview[] }>('/api/planner/reviews');
      setOwn(Object.fromEntries(data.items.map((item) => [item.placeSlug, item])));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return onUnauthorized();
      setError(true);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    // Fetch the author's own reviews once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (places.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const defaultVisitedOn =
    view.trip.endDate && view.trip.endDate <= today
      ? view.trip.endDate
      : view.trip.startDate && view.trip.startDate <= today
        ? view.trip.startDate
        : '';

  async function remove(slug: string) {
    setMessage('');
    try {
      await api(`/api/planner/reviews/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      setOwn((current) => {
        const next = { ...(current ?? {}) };
        delete next[slug];
        return next;
      });
      setMessage(t('planner.deleted'));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return onUnauthorized();
      setMessage(t('form.errors.generic'));
    }
  }

  return (
    <section aria-labelledby="place-reviews-heading" className="rounded-2xl bg-surface-muted p-5 md:p-8">
      <h2 id="place-reviews-heading" className="font-display text-2xl font-semibold">
        {t('planner.title')}
      </h2>
      <p className="mt-2 text-base text-foreground-muted">{t('planner.intro')}</p>
      {error ? <p className="mt-3 text-sm text-primary-strong">{t('planner.loadFailed')}</p> : null}

      <ul className="mt-5 grid list-none gap-3 p-0">
        {places.map((place) => {
          const mine = own?.[place.slug] ?? null;
          const isOpen = open === place.slug;
          return (
            <li key={place.slug} className="rounded-xl border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-medium">{place.name}</p>
                  {mine ? (
                    <p className="text-sm text-foreground-muted">
                      {t(`planner.status.${mine.status}`)}
                      {mine.status === 'rejected' && mine.rejectReason
                        ? ` — ${t('planner.reason', { reason: mine.rejectReason })}`
                        : ''}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`review-form-${place.slug}`}
                    className={buttonClass({ size: 'sm', variant: mine ? 'secondary' : 'primary' })}
                    onClick={() => setOpen(isOpen ? null : place.slug)}
                  >
                    {isOpen ? t('planner.close') : mine ? t('planner.edit') : t('planner.write')}
                  </button>
                  {mine ? (
                    <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' })} onClick={() => void remove(place.slug)}>
                      {t('planner.delete')}
                    </button>
                  ) : null}
                </div>
              </div>
              {isOpen ? (
                <div id={`review-form-${place.slug}`} className="mt-4 border-t border-border-subtle pt-4">
                  <ReviewForm
                    mode="planner"
                    place={place}
                    existing={mine}
                    defaultVisitedOn={defaultVisitedOn}
                    onUnauthorized={onUnauthorized}
                    onSaved={(saved) => setOwn((current) => ({ ...(current ?? {}), [saved.placeSlug]: saved }))}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p role="status" className="mt-3 min-h-6 text-sm text-foreground-muted" lang={locale}>
        {message}
      </p>
    </section>
  );
}
