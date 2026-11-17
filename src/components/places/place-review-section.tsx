'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api } from '@/components/planner/api';
import { ReviewForm } from '@/components/reviews/review-form';
import { contributionOpen } from '@/content/site';
import type { OwnRestriction, OwnReview } from '@/server/planner/schemas';

type Mode = 'loading' | 'guest' | 'member';

/**
 * Write-a-review block for one place page (PLACES-UI-S2, ADR 0014). The place
 * is fixed. The session is read from `GET /api/planner/session`; the server
 * stays the judge of every permission — the client only picks which form to
 * show. A visitor with no session gets the guest form.
 */
export function PlaceReviewSection({ place }: { place: { slug: string; name: string } }) {
  const t = useTranslations('communityReviews');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('loading');
  const [own, setOwn] = useState<OwnReview | null>(null);
  const [restrictions, setRestrictions] = useState<OwnRestriction[]>([]);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  const asGuest = useCallback(() => {
    setMode('guest');
    setOwn(null);
    setRestrictions([]);
  }, []);

  useEffect(() => {
    if (!contributionOpen) return;
    let cancelled = false;
    (async () => {
      try {
        await api('/api/planner/session');
      } catch {
        // 401 or any failure: show the guest form; the server decides on submit.
        if (!cancelled) setMode('guest');
        return;
      }
      try {
        const data = await api<{ items: OwnReview[]; restrictions?: OwnRestriction[] }>('/api/planner/reviews');
        if (cancelled) return;
        setRestrictions(data.restrictions ?? []);
        setOwn(data.items.find((item) => item.placeSlug === place.slug) ?? null);
        setMode('member');
      } catch (failure) {
        if (cancelled) return;
        if (failure instanceof ApiError && failure.status === 401) setMode('guest');
        else {
          setMode('member');
          setMessage(t('planner.loadFailed'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [place.slug, t]);

  if (!contributionOpen) {
    return <p className="rounded-md border border-border-strong bg-surface p-4 text-sm">{t('form.closed')}</p>;
  }

  async function remove() {
    setMessage('');
    try {
      await api(`/api/planner/reviews/${encodeURIComponent(place.slug)}`, { method: 'DELETE' });
      setOwn(null);
      setEditing(false);
      setMessage(t('planner.deleted'));
      router.refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return asGuest();
      setMessage(t('form.errors.generic'));
    }
  }

  const blocked = restrictions.find((row) => row.placeSlug === null || row.placeSlug === place.slug) ?? null;
  const showForm = mode === 'guest' || (mode === 'member' && !blocked && (own === null || editing));

  return (
    <div className="rounded-2xl bg-surface-muted p-5 md:p-8">
      <h3 className="font-display text-xl font-semibold">{t('placePage.writeTitle')}</h3>

      {mode === 'loading' ? (
        <p role="status" className="mt-3 text-sm text-foreground-muted">
          {t('placePage.loading')}
        </p>
      ) : null}

      {mode === 'member' && own ? (
        <div className="mt-4 rounded-xl border border-border-subtle bg-surface p-4">
          <p className="text-base font-medium">{t('placePage.yourReview')}</p>
          <p className="text-sm text-foreground-muted">
            {t(`planner.status.${own.status}`)}
            {own.status === 'rejected' && own.rejectReason ? ` — ${t('planner.reason', { reason: own.rejectReason })}` : ''}
          </p>
          {own.status === 'held' ? (
            <div role="note" className="mt-1 grid gap-1 text-sm">
              {/* Staff-written: plain text only. */}
              <p className="whitespace-pre-line break-words font-medium">{t('planner.question', { reason: own.rejectReason ?? '' })}</p>
              <p className="text-foreground-muted">{t('planner.heldHelp')}</p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              aria-expanded={editing}
              aria-controls="place-review-form"
              disabled={blocked !== null}
              className={buttonClass({ size: 'sm', variant: 'secondary' })}
              onClick={() => setEditing(!editing)}
            >
              {editing ? t('planner.close') : t('planner.edit')}
            </button>
            <button type="button" className={buttonClass({ size: 'sm', variant: 'ghost' })} onClick={() => void remove()}>
              {t('planner.delete')}
            </button>
          </div>
        </div>
      ) : null}

      {blocked ? (
        <p role="note" className="mt-3 whitespace-pre-line break-words text-sm font-medium">
          {t(blocked.placeSlug === null ? 'planner.restrictedAll' : 'planner.restrictedPlace', { reason: blocked.reason })}
          {blocked.expiresAt
            ? ` ${t('planner.restrictedUntil', { date: new Date(blocked.expiresAt).toLocaleDateString(locale) })}`
            : ''}
        </p>
      ) : null}

      {showForm ? (
        <div id="place-review-form" className="mt-4">
          {mode === 'guest' ? (
            <ReviewForm mode="guest" places={[]} fixedPlace={place} onSubmitted={() => router.refresh()} />
          ) : (
            <ReviewForm
              mode="planner"
              place={place}
              existing={own}
              defaultVisitedOn=""
              onUnauthorized={asGuest}
              onSaved={(saved) => {
                setOwn(saved);
                router.refresh();
              }}
            />
          )}
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-foreground-muted" lang={locale}>
        {message}
      </p>
    </div>
  );
}
