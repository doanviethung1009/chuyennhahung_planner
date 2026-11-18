import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AuditPage } from '@/server/planner/repository';

const TARGET_TYPES = ['trip', 'review', 'user', 'story'] as const;
export const AUDIT_ACTIONS = [
  'user_create',
  'role_change',
  'password_reset',
  'ban',
  'unban',
  'soft_delete',
  'restore',
  'purge',
  'google_unlink',
  'token_rotate',
  'publish',
  'unpublish',
  'archive',
] as const;

export type AuditFilters = { actor?: string; targetType?: string; action?: string; from?: string; to?: string };

const field =
  'min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const btn =
  'inline-flex min-h-11 items-center justify-center rounded-pill px-5 text-sm font-medium transition-colors duration-200 ease-gentle';

/** Filter form: a plain GET, so it works without JavaScript and the URL is shareable. */
export async function AuditFilterForm({ filters }: { filters: AuditFilters }) {
  const t = await getTranslations('adminAudit');
  return (
    <form method="get" role="search" aria-label={t('filtersLabel')} className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <label className="grid gap-1 text-sm font-medium">
        {t('actor')}
        <input name="actor" defaultValue={filters.actor ?? ''} maxLength={80} placeholder={t('actorHint')} className={field} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t('targetType')}
        <select name="targetType" defaultValue={filters.targetType ?? ''} className={field}>
          <option value="">{t('anyType')}</option>
          {TARGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t('action')}
        <select name="action" defaultValue={filters.action ?? ''} className={field}>
          <option value="">{t('anyAction')}</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {t(`actions.${action}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t('from')}
        <input type="date" name="from" defaultValue={filters.from ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t('to')}
        <input type="date" name="to" defaultValue={filters.to ?? ''} className={field} />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <button type="submit" className={`${btn} bg-primary text-primary-foreground hover:bg-primary-strong`}>
          {t('apply')}
        </button>
        <Link href="/admin/audit" className={`${btn} border border-border-strong hover:border-primary`}>
          {t('reset')}
        </Link>
      </div>
    </form>
  );
}

/**
 * The event table. Every value is rendered as a React text node, so a `reason`
 * (which may quote a person's text) is inert: never HTML, never a link.
 */
export async function AuditTable({
  page,
  filters,
  locale,
}: {
  page: AuditPage;
  filters: AuditFilters;
  locale: string;
}) {
  const t = await getTranslations('adminAudit');
  if (page.items.length === 0) return <p role="status">{t('empty')}</p>;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' });
  const label = (group: 'actions' | 'types', key: string): string =>
    // Community events (10.2) carry action names this page has no label for: show them as stored.
    t.has(`${group}.${key}` as never) ? t(`${group}.${key}` as never) : key;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-foreground-muted" role="status">
        {t('count', { count: page.items.length })}
      </p>
      <div className="overflow-x-auto rounded-md border border-border-subtle" tabIndex={0} role="region" aria-label={t('tableLabel')}>
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {(['colTime', 'colActor', 'colAction', 'colTarget', 'colChange', 'colReason'] as const).map((key) => (
                <th key={key} scope="col" className="px-3 py-3 font-semibold">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.items.map((event) => (
              <tr key={event.id} className="border-t border-border-subtle align-top">
                <td className="px-3 py-3 whitespace-nowrap">
                  <time dateTime={event.createdAt}>{fmt.format(new Date(event.createdAt))}</time>
                </td>
                <td className="px-3 py-3 break-words">
                  {event.actorKind === 'service' ? t('service') : (event.actorHandle ?? event.actorId)}
                  {event.actorKind === 'user' && event.actorHandle ? (
                    <span className="block text-xs text-foreground-muted">{event.actorId}</span>
                  ) : null}
                </td>
                <td className="px-3 py-3">{label('actions', event.action)}</td>
                <td className="px-3 py-3 break-words">
                  {label('types', event.targetKind)}
                  <span className="block text-xs text-foreground-muted">{event.targetId}</span>
                </td>
                <td className="px-3 py-3">
                  {event.fromStatus || event.toStatus ? `${event.fromStatus ?? '–'} → ${event.toStatus ?? '–'}` : '–'}
                </td>
                <td className="px-3 py-3 break-words">{event.reason ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page.nextCursor ? (
        <nav aria-label={t('next')}>
          <Link
            href={{ pathname: '/admin/audit', query: { ...filters, cursor: page.nextCursor } }}
            className={`${btn} border border-border-strong hover:border-primary`}
          >
            {t('next')}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
