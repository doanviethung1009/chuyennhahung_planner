'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';
import { LiveNotice, StatusBadge } from './notices';
import { useErrorNotice, type Notice } from './use-record';

interface Localized {
  vi: string;
  en: string;
}
interface Item {
  slug: string;
  updatedAt: string;
  status?: string;
  title?: Localized;
  name?: Localized;
}

const STATUSES = ['', 'draft', 'published', 'archived'] as const;

/** Stories and places index. Places have no lifecycle, so no status filter. */
export function ContentList({ kind }: { kind: 'stories' | 'places' }) {
  const t = useTranslations('adminContent');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>('');
  const [error, setError] = useState<Notice | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = kind === 'stories' && filter ? `?status=${filter}` : '';
      const data = await api<Record<string, Item[]>>(`/api/admin/travel/${kind}${query}`);
      setItems(data[kind] ?? []);
    } catch (failure) {
      setItems(null);
      setError(describe(failure));
    }
  }, [kind, filter, describe]);

  useEffect(() => {
    // Fetch on mount and whenever the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function archive(slug: string) {
    setArchiving(slug);
    setNotice(null);
    try {
      await api(`/api/admin/travel/stories/${encodeURIComponent(slug)}/status`, { method: 'POST', body: { action: 'archive' } });
      setNotice({ kind: 'ok', text: t('list.archived') });
      await load();
    } catch (failure) {
      setNotice(describe(failure));
    } finally {
      setArchiving(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        {kind === 'stories' ? (
          <Link href="/admin/content/stories/new" className={buttonClass({ size: 'md' })}>
            {t('stories.newButton')}
          </Link>
        ) : (
          <Link href="/admin/content/places/new" className={buttonClass({ size: 'md' })}>
            {t('places.newButton')}
          </Link>
        )}
      </div>
      {kind === 'stories' ? (
        <div className="max-w-xs">
          <label htmlFor="content-status-filter" className="block text-sm font-medium text-foreground">
            {t('list.filterLabel')}
          </label>
          <div className="mt-1.5">
            <select
              id="content-status-filter"
              className={inputClass}
              value={filter}
              onChange={(e) => setFilter(e.target.value as (typeof STATUSES)[number])}
            >
              {STATUSES.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? t(`statuses.${value}`) : t('list.all')}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <LiveNotice notice={error ?? notice} />
      {error ? (
        <div>
          <button type="button" onClick={() => void load()} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            {t('list.retry')}
          </button>
        </div>
      ) : null}

      {items === null ? (
        error ? null : <p className="text-base text-foreground-muted">{t('form.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-base text-foreground-muted">{t('list.empty')}</p>
      ) : (
        <>
          <p className="text-sm text-foreground-muted">{t('list.count', { count: items.length })}</p>
          <ul className="grid gap-3">
            {items.map((item) => {
              const title = (item.title ?? item.name)?.[locale] ?? item.slug;
              return (
                <li
                  key={item.slug}
                  className="grid gap-2 rounded-md border border-border-subtle bg-surface p-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div className="grid gap-1.5">
                    {kind === 'stories' ? (
                      <Link
                        href={{ pathname: '/admin/content/stories/[slug]', params: { slug: item.slug } }}
                        className="min-h-11 content-center font-display text-xl text-primary-strong underline underline-offset-4"
                      >
                        {title}
                      </Link>
                    ) : (
                      <Link
                        href={{ pathname: '/admin/content/places/[slug]', params: { slug: item.slug } }}
                        className="min-h-11 content-center font-display text-xl text-primary-strong underline underline-offset-4"
                      >
                        {title}
                      </Link>
                    )}
                    <p className="text-sm text-foreground-muted">
                      {item.slug} · {t('list.updated', { date: new Date(item.updatedAt).toLocaleString(locale) })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {item.status ? <StatusBadge status={item.status} /> : null}
                    {kind === 'stories' && item.status && item.status !== 'archived' ? (
                      <button
                        type="button"
                        disabled={archiving !== null}
                        onClick={() => void archive(item.slug)}
                        className={buttonClass({ variant: 'secondary', size: 'sm' })}
                      >
                        {t('actions.archive')}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
