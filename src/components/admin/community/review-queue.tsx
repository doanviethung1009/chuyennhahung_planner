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

type Decision = 'approve' | 'reject' | 'remove' | 'hold';

/**
 * Staff queue for traveller place reviews (ADR 0014). Planner-written reviews
 * wait here as `pending`; guest reviews are already live and can only be
 * removed. Review text is shown as plain text.
 */
export function CommunityReviewQueue() {
  const t = useTranslations('adminCommunity');
  const tr = useTranslations('adminCommunity.reviews');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; decision: 'reject' | 'remove' | 'hold' } | null>(null);
  const [reason, setReason] = useState('');

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
                      {tr('meta', {
                        place: item.placeSlug,
                        rating: item.rating,
                        author: item.author ?? tr('anonymous'),
                        source: tr(`sources.${item.source}`),
                      })}
                    </p>
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
                </div>

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
