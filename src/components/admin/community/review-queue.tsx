'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';
import { LiveNotice } from '@/components/admin/content/notices';
import { useErrorNotice, type Notice } from '@/components/admin/content/use-record';
import type { ReviewQueueItem } from '@/server/planner/schemas';
import { PlaceLink, placeLabel } from './place-link';

type Decision = 'approve' | 'reject' | 'remove' | 'hold';

/**
 * Staff queue for traveller place reviews (ADR 0014). Planner-written reviews
 * wait here as `pending`; guest reviews are already live and can only be
 * removed. Review text is shown as plain text.
 */
export function CommunityReviewQueue({ canRestrict }: { canRestrict: boolean }) {
  const t = useTranslations('adminCommunity');
  const tr = useTranslations('adminCommunity.reviews');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; decision: 'reject' | 'remove' | 'hold' } | null>(null);
  const [reason, setReason] = useState('');
  const [muting, setMuting] = useState<{ id: string; scope: 'place' | 'all' } | null>(null);
  const [muteReason, setMuteReason] = useState('');

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: ReviewQueueItem[] }>('/api/admin/community/reviews')).items);
    } catch (failure) {
      setItems(null);
      setNotice(describe(failure));
    }
  }, [describe]);

  useEffect(() => {
    // Fetch once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(item: ReviewQueueItem, decision: Decision, why?: string) {
    setBusyId(item.id);
    setNotice(null);
    try {
      await api(`/api/admin/community/reviews/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: why ? { decision, reason: why } : { decision },
      });
      setAsking(null);
      setReason('');
      setNotice({ kind: 'ok', text: t(`done.${decision}`) });
      await load();
    } catch (failure) {
      setNotice(describe(failure));
    } finally {
      setBusyId(null);
    }
  }

  async function mute(item: ReviewQueueItem, scope: 'place' | 'all', why: string) {
    setBusyId(item.id);
    setNotice(null);
    try {
      await api('/api/admin/community/restrictions', {
        method: 'POST',
        body: { reviewId: item.id, scope, reason: why },
      });
      setMuting(null);
      setMuteReason('');
      setNotice({ kind: 'ok', text: t('done.mute') });
      await load();
    } catch (failure) {
      setNotice(describe(failure));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <LiveNotice notice={notice} onReload={() => void load()} />
      {items === null ? (
        notice ? null : <p className="text-base text-foreground-muted">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-base text-foreground-muted">{tr('empty')}</p>
      ) : (
        <ul className="grid gap-4">
          {items.map((item) => {
            const isAsking = asking?.id === item.id;
            return (
              <li key={item.id} className="grid gap-3 rounded-md border border-border-subtle bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="text-sm text-foreground-muted">
                      <PlaceLink place={item.place} slug={item.placeSlug} />
                      {' · '}
                      {tr('meta', {
                        rating: item.rating,
                        author: item.author ?? tr('anonymous'),
                        source: tr(`sources.${item.source}`),
                      })}
                    </p>
                    {item.guestLimitAt ? (
                      <p className="text-sm font-medium text-foreground">
                        <span className="inline-flex items-center rounded-pill border border-border-strong bg-surface-muted px-3 py-1 text-xs">
                          {tr('guestLimitBadge')}
                        </span>{' '}
                        <span className="text-foreground-muted">
                          {tr('guestLimitAt', { date: new Date(item.guestLimitAt).toLocaleString(locale) })}
                        </span>
                      </p>
                    ) : null}
                    {item.authorAccount ? (
                      <p className="text-sm text-foreground-muted">{tr('account', { name: item.authorAccount })}</p>
                    ) : null}
                    {/* Traveller-written: plain text only. */}
                    <p lang={item.lang} className="whitespace-pre-line break-words text-base">
                      {item.body}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {tr('visited', { date: item.visitedOn })} ·{' '}
                      {tr('created', { date: new Date(item.createdAt).toLocaleString(locale) })}
                    </p>
                    {item.rejectReason ? (
                      <p className="text-sm text-foreground-muted">{t('reason', { reason: item.rejectReason })}</p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center rounded-pill border border-border-strong bg-surface-muted px-3 py-1 text-xs font-medium">
                    {tr(`statuses.${item.status}`)}
                    {item.restricted ? ` · ${tr('restrictedBadge')}` : ''}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {item.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        className={buttonClass({ size: 'sm' })}
                        onClick={() => void decide(item, 'approve')}
                      >
                        {t('approve')}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        className={buttonClass({ variant: 'secondary', size: 'sm' })}
                        onClick={() => setAsking({ id: item.id, decision: 'reject' })}
                      >
                        {t('reject')}
                      </button>
                    </>
                  ) : null}
                  {item.status === 'approved' && item.source === 'planner' ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      className={buttonClass({ variant: 'secondary', size: 'sm' })}
                      onClick={() => setAsking({ id: item.id, decision: 'hold' })}
                    >
                      {tr('hold')}
                    </button>
                  ) : null}
                  {item.status === 'approved' || item.status === 'held' ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      className={buttonClass({ variant: 'secondary', size: 'sm' })}
                      onClick={() => setAsking({ id: item.id, decision: 'remove' })}
                    >
                      {tr('remove')}
                    </button>
                  ) : null}
                  {canRestrict && !item.restricted && item.status !== 'pending' ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      className={buttonClass({ variant: 'ghost', size: 'sm' })}
                      onClick={() => setMuting({ id: item.id, scope: 'place' })}
                    >
                      {tr('mute')}
                    </button>
                  ) : null}
                </div>

                {muting?.id === item.id ? (
                  <form
                    className="grid gap-3 border-t border-border-subtle pt-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mute(item, muting.scope, muteReason.trim());
                    }}
                  >
                    <fieldset className="grid gap-2">
                      <legend className="text-sm font-medium">{tr('muteScope')}</legend>
                      {(item.source === 'homepage' ? (['place'] as const) : (['place', 'all'] as const)).map((scope) => (
                        <label key={scope} className="flex min-h-11 items-center gap-2 text-base">
                          <input
                            type="radio"
                            name={`mute-scope-${item.id}`}
                            checked={muting.scope === scope}
                            onChange={() => setMuting({ id: item.id, scope })}
                          />
                          {tr(`muteScopes.${scope}`, { place: placeLabel(item.place, item.placeSlug, locale) })}
                        </label>
                      ))}
                    </fieldset>
                    <p className="text-sm text-foreground-muted">
                      {tr(item.source === 'homepage' ? 'muteGuestWarning' : 'muteHelp')}
                    </p>
                    <label htmlFor={`mute-reason-${item.id}`} className="text-sm font-medium">
                      {tr('muteReasonLabel')}
                    </label>
                    <textarea
                      id={`mute-reason-${item.id}`}
                      className={inputClass}
                      rows={3}
                      required
                      minLength={3}
                      maxLength={500}
                      value={muteReason}
                      onChange={(e) => setMuteReason(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={busyId === item.id} className={buttonClass({ size: 'sm' })}>
                        {tr('muteConfirm')}
                      </button>
                      <button
                        type="button"
                        className={buttonClass({ variant: 'ghost', size: 'sm' })}
                        onClick={() => {
                          setMuting(null);
                          setMuteReason('');
                        }}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </form>
                ) : null}

                {isAsking && asking ? (
                  <form
                    className="grid gap-3 border-t border-border-subtle pt-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void decide(item, asking.decision, reason.trim());
                    }}
                  >
                    <label htmlFor={`review-reason-${item.id}`} className="text-sm font-medium">
                      {asking.decision === 'hold'
                        ? tr('reasonLabelHold')
                        : tr(item.source === 'homepage' ? 'reasonLabelGuest' : 'reasonLabel')}
                    </label>
                    <textarea
                      id={`review-reason-${item.id}`}
                      className={inputClass}
                      rows={3}
                      required
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={busyId === item.id} className={buttonClass({ size: 'sm' })}>
                        {t(`confirm.${asking.decision}`)}
                      </button>
                      <button
                        type="button"
                        className={buttonClass({ variant: 'ghost', size: 'sm' })}
                        onClick={() => {
                          setAsking(null);
                          setReason('');
                        }}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
