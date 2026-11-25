'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';
import { LiveNotice } from './notices';
import { useErrorNotice, type Notice } from './use-record';
import { SORT_KEYS, filterAndSort, itemTitle, type SortKey } from './list-utils';

interface Item {
  slug: string;
  updatedAt: string;
  title: { vi: string; en: string };
  visibility: 'private' | 'public';
  durationDays: number;
}

/** Templates index (P07-6): search, sort and a link into the editor. Create and delete are not offered. */
export function TemplateList() {
  const t = useTranslations('adminContent');
  const tt = useTranslations('adminContent.templates');
  const locale = useLocale() as Locale;
  const lang = locale === 'en' ? 'en' : 'vi';
  const describe = useErrorNotice();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<Notice | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<{ templates: Item[] }>('/api/admin/travel/templates');
      setItems(data.templates ?? []);
    } catch (failure) {
      setItems(null);
      setError(describe(failure));
    }
  }, [describe]);

  useEffect(() => {
    // Fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const visible = useMemo(() => (items ? filterAndSort(items, { query, sort, locale: lang }) : null), [items, query, sort, lang]);

  return (
    <div className="grid gap-6">
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="content-search" className="block text-sm font-medium text-foreground">
            {t('list.searchLabel')}
          </label>
          <div className="mt-1.5">
            <input
              id="content-search"
              type="search"
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label htmlFor="content-sort" className="block text-sm font-medium text-foreground">
            {t('list.sortLabel')}
          </label>
          <div className="mt-1.5">
            <select id="content-sort" className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`list.sort.${key}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <LiveNotice notice={error} />
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
      ) : visible && visible.length === 0 ? (
        <div className="grid justify-items-start gap-3">
          <p role="status" className="text-base text-foreground-muted">
            {t('list.noMatches')}
          </p>
          <button
            type="button"
            className={buttonClass({ variant: 'secondary', size: 'sm' })}
            onClick={() => {
              setQuery('');
            }}
          >
            {t('list.clearFilters')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground-muted">{t('list.count', { count: visible?.length ?? 0 })}</p>
          <ul className="grid gap-3">
            {(visible ?? []).map((item) => (
              <li key={item.slug} className="grid gap-2 rounded-md border border-border-subtle bg-surface p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="grid gap-1.5">
                  <Link
                    href={{ pathname: '/admin/content/templates/[slug]', params: { slug: item.slug } }}
                    className="min-h-11 content-center font-display text-xl text-primary-strong underline underline-offset-4"
                  >
                    {itemTitle(item, lang)}
                  </Link>
                  <p className="text-sm text-foreground-muted">
                    {item.slug} · {tt('days', { count: item.durationDays })} ·{' '}
                    {t('list.updated', { date: new Date(item.updatedAt).toLocaleString(locale) })}
                  </p>
                </div>
                <span className="inline-flex min-h-7 items-center rounded-pill border border-border-strong bg-surface px-3 text-sm font-medium text-foreground">
                  {tt(`visibility.${item.visibility}`)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
