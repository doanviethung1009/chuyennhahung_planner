'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import type { AuditEvent } from '@/server/planner/schemas';

/**
 * Shared building blocks so the four moderation lists look and behave alike
 * (P07-14). Presentation only: none of them fetches except `HistoryLink`, which
 * only reads the existing audit endpoint.
 */

/** One titled block of the workspace. `id` is the jump-link target; `count` is the list length it shows. */
export function QueueSection({
  id,
  heading,
  count,
  level = 2,
  children,
}: {
  id?: string;
  heading: string;
  count?: number | null;
  level?: 2 | 3;
  children: ReactNode;
}) {
  const headingId = `${id ?? heading}-heading`;
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section id={id} aria-labelledby={headingId} className="grid scroll-mt-24 gap-4">
      <Heading
        id={headingId}
        className={level === 2 ? 'font-display text-2xl font-semibold' : 'font-display text-xl font-semibold'}
      >
        {heading}
        {count === null || count === undefined ? null : (
          <span className="ml-2 text-base font-normal text-foreground-muted">({count})</span>
        )}
      </Heading>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-border-strong p-4 text-base text-foreground-muted">{children}</p>;
}

/** The pill at the top-right of every item card. */
export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-border-strong bg-surface-muted px-3 py-1 text-xs font-medium">
      {children}
    </span>
  );
}

/** The one action row of every item card: buttons in reading order, history last. */
export function ItemActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/**
 * "History" disclosure for one trip or review: loads `GET /api/admin/community/events?targetId=`
 * on first open and lists what happened, newest first. Read-only.
 */
export function HistoryLink({ targetId }: { targetId: string }) {
  const t = useTranslations('adminCommunity.workspace.history');
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const panelId = `history-${targetId}`;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && events === null) {
      try {
        setFailed(false);
        const body = await api<{ items: AuditEvent[] }>(`/api/admin/community/events?targetId=${encodeURIComponent(targetId)}`);
        setEvents(body.items);
      } catch {
        setFailed(true);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className={buttonClass({ variant: 'ghost', size: 'sm' })}
        onClick={() => void toggle()}
      >
        {open ? t('hide') : t('show')}
      </button>
      {open ? (
        <div id={panelId} className="basis-full border-t border-border-subtle pt-3">
          {failed ? (
            <p role="alert" className="text-sm text-foreground-muted">
              {t('failed')}
            </p>
          ) : events === null ? (
            <p className="text-sm text-foreground-muted">{t('loading')}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-foreground-muted">{t('empty')}</p>
          ) : (
            <ol className="grid gap-2">
              {events.map((event) => (
                <li key={event.id} className="grid gap-0.5 text-sm">
                  <p className="font-medium">
                    {event.action}
                    {event.fromStatus || event.toStatus ? ` · ${event.fromStatus ?? '—'} → ${event.toStatus ?? '—'}` : ''}
                  </p>
                  <p className="text-foreground-muted">
                    {t('by', { by: event.actorId, date: new Date(event.createdAt).toLocaleString(locale) })}
                  </p>
                  {/* Staff-written: plain text only. */}
                  {event.reason ? <p className="whitespace-pre-line break-words text-foreground-muted">{event.reason}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </>
  );
}
