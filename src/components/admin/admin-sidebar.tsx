'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import type { AdminNavGroup } from '@/lib/admin-gate';

const linkBase =
  'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-200 ease-gentle';
const linkIdle = 'text-foreground hover:bg-surface-muted hover:text-primary-strong';
const linkCurrent = 'bg-surface-muted text-primary-strong';

/** Active on the link's own page and on its detail pages (`/admin` only on itself). */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));
}

/**
 * Grouped admin navigation (ADR 0020). A client island only for the phone
 * menu toggle and `aria-current`; the groups arrive already filtered by role
 * from the server layout. Hiding is not authorization.
 */
export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const t = useTranslations('adminContent.nav');
  const pathname = usePathname();
  const menuId = useId();
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  return (
    <aside className="border-b border-border-subtle bg-surface lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between px-5 py-2 lg:hidden">
        <span className="text-sm font-medium text-foreground-muted">{t('label')}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenAt(open ? null : pathname)}
          className="inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-4 text-sm font-medium text-foreground"
        >
          {open ? t('closeMenu') : t('openMenu')}
        </button>
      </div>
      <nav
        id={menuId}
        aria-label={t('label')}
        className={`${open ? 'block' : 'hidden'} px-5 pb-4 lg:sticky lg:top-0 lg:block lg:px-4 lg:py-6`}
      >
        <ul className="grid gap-5">
          {groups.map((group) => (
            <li key={group.id}>
              <p className="text-eyebrow mb-1 px-3 text-foreground-muted">{t(`groups.${group.id}`)}</p>
              <ul className="grid gap-1">
                {group.links.map((link) => {
                  const current = isCurrent(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={current ? 'page' : undefined}
                        className={`${linkBase} ${current ? linkCurrent : linkIdle}`}
                      >
                        {t(link.label)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/** Breadcrumb for the current admin page, derived from the same role-filtered groups. */
export function AdminBreadcrumb({ groups }: { groups: AdminNavGroup[] }) {
  const t = useTranslations('adminContent.nav');
  const pathname = usePathname();

  const hit = groups
    .flatMap((group) => group.links.map((link) => ({ group, link })))
    .find(({ link }) => link.href !== '/admin' && isCurrent(pathname, link.href));

  return (
    <nav aria-label={t('breadcrumb')} className="px-5 pt-4 text-sm text-foreground-muted md:px-8">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          {hit ? (
            <Link href="/admin" className="inline-flex min-h-11 items-center underline underline-offset-4">
              {t('home')}
            </Link>
          ) : (
            <span aria-current="page">{t('home')}</span>
          )}
        </li>
        {hit ? (
          <>
            <li aria-hidden="true">/</li>
            <li>{t(`groups.${hit.group.id}`)}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{t(hit.link.label)}</li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}
