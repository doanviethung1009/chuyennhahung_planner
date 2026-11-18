'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getDestination } from '@/content/destinations';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';
import { LiveNotice } from '@/components/admin/content/notices';
import { useErrorNotice, type Notice } from '@/components/admin/content/use-record';
import type { ListingQueueItem } from '@/server/planner/schemas';
import { EmptyState, HistoryLink, ItemActions, QueueSection, StatusBadge } from './queue-parts';
import { sectionId, splitTrips } from './workspace-model';
import { useReportCount } from './workspace';

type Decision = 'approve' | 'reject' | 'remove';

/** Staff queue for community trip listings (ADR 0014). Pending first. */
export function ListingQueue() {
  const t = useTranslations('adminCommunity');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const [items, setItems] = useState<ListingQueueItem[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; decision: 'reject' | 'remove' } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: ListingQueueItem[] }>('/api/admin/community/queue')).items);
    } catch (failure) {
      setItems(null);
      setNotice(describe(failure));
    }
  }, [describe]);

  const groups = items ? splitTrips(items) : null;
  useReportCount('trips', groups ? groups.pending.length : null);

  useEffect(() => {
    // Fetch once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(item: ListingQueueItem, decision: Decision, why?: string) {
    setBusyId(item.tripId);
    setNotice(null);
    try {
      await api(`/api/admin/community/trips/${encodeURIComponent(item.tripId)}`, {
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

  const renderItem = (item: ListingQueueItem) => {
    const destination = getDestination(item.destinationSlug)?.name[locale] ?? item.destinationSlug;
    const status = item.listing.status;
    const isAsking = asking?.id === item.tripId;
    return (
      <li key={item.tripId} className="grid gap-3 rounded-md border border-border-subtle bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            {/* Traveller-written: plain text only. */}
            <h3 className="font-display text-xl text-foreground">{item.title}</h3>
            <p className="text-sm text-foreground-muted">
              {t('meta', {
                owner: item.ownerDisplayName,
                destination,
                days: item.durationDays,
                activities: item.activityCount,
                author: t(`author.${item.listing.authorDisplay}`),
              })}
            </p>
            <p className="text-sm text-foreground-muted">
              {t('requested', { date: new Date(item.listing.requestedAt).toLocaleString(locale) })}
            </p>
            {item.listing.rejectReason ? (
              <p className="text-sm text-foreground-muted">{t('reason', { reason: item.listing.rejectReason })}</p>
            ) : null}
          </div>
          <StatusBadge>{t(`statuses.${status}`)}</StatusBadge>
        </div>

        <ItemActions>
          {item.shareToken ? (
            <a
              href={getPathname({ href: { pathname: '/shared/[token]', params: { token: item.shareToken } }, locale })}
              target="_blank"
              rel="noreferrer"
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              {t('view')}
            </a>
          ) : null}
          {status === 'pending' ? (
            <>
              <button
                type="button"
                disabled={busyId === item.tripId}
                className={buttonClass({ size: 'sm' })}
                onClick={() => void decide(item, 'approve')}
              >
                {t('approve')}
              </button>
              <button
                type="button"
                disabled={busyId === item.tripId}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
                onClick={() => setAsking({ id: item.tripId, decision: 'reject' })}
              >
                {t('reject')}
              </button>
            </>
          ) : null}
          {status === 'approved' ? (
            <button
              type="button"
              disabled={busyId === item.tripId}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
              onClick={() => setAsking({ id: item.tripId, decision: 'remove' })}
            >
              {t('remove')}
            </button>
          ) : null}
          <HistoryLink targetId={item.tripId} />
        </ItemActions>

        {isAsking && asking ? (
          <form
            className="grid gap-3 border-t border-border-subtle pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void decide(item, asking.decision, reason.trim());
            }}
          >
            <label htmlFor={`reason-${item.tripId}`} className="text-sm font-medium">
              {t('reasonLabel')}
            </label>
            <textarea
              id={`reason-${item.tripId}`}
              className={inputClass}
              rows={3}
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busyId === item.tripId} className={buttonClass({ size: 'sm' })}>
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
  };

  const pending = groups?.pending ?? [];
  const decided = groups?.decided ?? [];

  return (
    <QueueSection id={sectionId('trips')} heading={t('tripsHeading')} count={groups ? pending.length : null}>
      <LiveNotice notice={notice} onReload={() => void load()} />
      {items === null ? (
        notice ? null : <p className="text-base text-foreground-muted">{t('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <>
          {pending.length === 0 ? (
            <EmptyState>{t('workspace.emptyPending.trips')}</EmptyState>
          ) : (
            <ul className="grid gap-4">{pending.map(renderItem)}</ul>
          )}
          {decided.length > 0 ? (
            <QueueSection id="trips-decided" heading={t('workspace.decided')} count={decided.length} level={3}>
              <ul className="grid gap-4">{decided.map(renderItem)}</ul>
            </QueueSection>
          ) : null}
        </>
      )}
    </QueueSection>
  );
}
