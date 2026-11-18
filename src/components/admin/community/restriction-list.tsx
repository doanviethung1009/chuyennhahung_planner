'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { LiveNotice } from '@/components/admin/content/notices';
import { useErrorNotice, type Notice } from '@/components/admin/content/use-record';
import type { RestrictionListItem } from '@/server/planner/schemas';
import { PlaceLink } from './place-link';
import { EmptyState, ItemActions, QueueSection, StatusBadge } from './queue-parts';
import { sectionId } from './workspace-model';
import { useReportCount } from './workspace';

/**
 * Staff list of switched-off authors (ADR 0015). Shows the reason, who did it
 * and until when; never an author id or a guest key. Lifting keeps the row as
 * the record.
 */
export function RestrictionList() {
  const t = useTranslations('adminCommunity.restrictions');
  const tc = useTranslations('adminCommunity');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const [items, setItems] = useState<RestrictionListItem[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: RestrictionListItem[] }>('/api/admin/community/restrictions')).items);
    } catch (failure) {
      setItems(null);
      setNotice(describe(failure));
    }
  }, [describe]);

  useReportCount('restrictions', items ? items.length : null);

  useEffect(() => {
    // Fetch once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function lift(item: RestrictionListItem) {
    setBusyId(item.id);
    setNotice(null);
    try {
      await api(`/api/admin/community/restrictions/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      setNotice({ kind: 'ok', text: t('lifted') });
      await load();
    } catch (failure) {
      setNotice(describe(failure));
    } finally {
      setBusyId(null);
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleString(locale);

  return (
    <QueueSection id={sectionId('restrictions')} heading={tc('restrictionsHeading')} count={items ? items.length : null}>
      <LiveNotice notice={notice} onReload={() => void load()} />
      {items === null ? null : items.length === 0 ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <ul className="grid gap-4">
          {items.map((item) => (
            <li key={item.id} className="grid gap-3 rounded-md border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <p className="text-base font-medium">
                    {item.author ?? t('guest')} ·{' '}
                    {item.placeSlug ? <PlaceLink place={item.place} slug={item.placeSlug} /> : t('allPlaces')}
                  </p>
                  {/* Staff-written: plain text only. */}
                  <p className="whitespace-pre-line break-words text-base">{t('reason', { reason: item.reason })}</p>
                  <p className="text-sm text-foreground-muted">
                    {t('createdBy', { by: item.createdBy, date: when(item.createdAt) })}
                    {item.expiresAt ? ` · ${t('until', { date: when(item.expiresAt) })}` : ''}
                    {item.liftedAt ? ` · ${t('liftedBy', { by: item.liftedBy ?? '', date: when(item.liftedAt) })}` : ''}
                  </p>
                </div>
                <StatusBadge>{item.active ? t('active') : t('inactive')}</StatusBadge>
              </div>
              {item.active ? (
                <ItemActions>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    className={buttonClass({ variant: 'secondary', size: 'sm' })}
                    onClick={() => void lift(item)}
                  >
                    {t('lift')}
                  </button>
                </ItemActions>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </QueueSection>
  );
}
