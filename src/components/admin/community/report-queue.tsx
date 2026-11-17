'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';
import { LiveNotice } from '@/components/admin/content/notices';
import { useErrorNotice, type Notice } from '@/components/admin/content/use-record';
import type { ReportListItem, ReportStatus } from '@/server/planner/schemas';

const STATUSES: ReportStatus[] = ['open', 'actioned', 'dismissed'];

/**
 * Staff list of reader reports (batch 10.5). Shows the report and what it points
 * at, never who filed it (only whether they were signed in). "Actioned" marks the
 * report only: removing the content is the remove action in the queues above.
 * The note is reader-written text, rendered as plain text.
 */
export function ReportQueue() {
  const t = useTranslations('adminReports');
  const locale = useLocale() as Locale;
  const uid = useId();
  const describe = useErrorNotice();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [items, setItems] = useState<ReportListItem[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: ReportListItem[] }>(`/api/admin/community/reports?status=${status}`)).items);
    } catch (failure) {
      setItems(null);
      setNotice(describe(failure));
    }
  }, [describe, status]);

  useEffect(() => {
    // Fetch on mount and whenever the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function resolve(item: ReportListItem, outcome: 'dismissed' | 'actioned') {
    setBusyId(item.id);
    setNotice(null);
    try {
      await api(`/api/admin/community/reports/${encodeURIComponent(item.id)}/resolve`, {
        method: 'POST',
        body: { outcome, reason: (reasons[item.id] ?? '').trim() },
      });
      setNotice({ kind: 'ok', text: t('done') });
      await load();
    } catch (failure) {
      setNotice(describe(failure));
    } finally {
      setBusyId(null);
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleString(locale);

  return (
    <div className="grid gap-4">
      <p className="text-base text-foreground-muted">{t('description')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${uid}-status`} className="text-sm font-medium">
          {t('filter')}
        </label>
        <select
          id={`${uid}-status`}
          className={`${inputClass} !w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value as ReportStatus)}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`statuses.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <LiveNotice notice={notice} onReload={() => void load()} />
      {items === null ? null : items.length === 0 ? (
        <p className="text-base text-foreground-muted">{t('empty')}</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="grid gap-2 rounded-md border border-border-subtle bg-surface p-4">
              <p className="text-base font-medium">
                {t(`kinds.${item.targetKind}`)} · {t(`reasons.${item.reason}`)} ·{' '}
                {item.signedIn ? t('signedIn') : t('guest')}
              </p>
              <p className="whitespace-pre-line break-words text-base">
                {item.targetLabel ?? t('removedLabel')}
              </p>
              {item.note ? <p className="whitespace-pre-line break-words text-base">{t('note', { note: item.note })}</p> : null}
              <p className="text-sm text-foreground-muted">{t('filed', { date: when(item.createdAt) })}</p>
              {!item.targetLive ? <p className="text-sm text-foreground-muted">{t('gone')}</p> : null}
              {item.status === 'open' ? (
                <div className="grid gap-2">
                  <label htmlFor={`${uid}-${item.id}`} className="text-sm font-medium">
                    {t('reasonLabel')}
                  </label>
                  <input
                    id={`${uid}-${item.id}`}
                    type="text"
                    maxLength={500}
                    className={inputClass}
                    value={reasons[item.id] ?? ''}
                    onChange={(e) => setReasons((current) => ({ ...current, [item.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busyId === item.id || (reasons[item.id] ?? '').trim().length < 3}
                      className={buttonClass({ variant: 'secondary', size: 'sm' })}
                      onClick={() => void resolve(item, 'dismissed')}
                    >
                      {t('dismiss')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id || (reasons[item.id] ?? '').trim().length < 3}
                      className={buttonClass({ size: 'sm' })}
                      onClick={() => void resolve(item, 'actioned')}
                    >
                      {t('action')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-line break-words text-sm text-foreground-muted">
                  {t('handled', {
                    status: t(`statuses.${item.status}`),
                    by: item.handledBy ?? '',
                    date: item.handledAt ? when(item.handledAt) : '',
                    reason: item.handlerReason ?? '',
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
