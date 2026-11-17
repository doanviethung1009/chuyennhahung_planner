'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/ui/container';
import { Link, usePathname } from '@/i18n/navigation';
import type { AdminNavGroup } from '@/lib/admin-gate';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { AdminSignOut } from './admin-sign-out';

const linkBase =
  'flex min-h-11 items-center border-l-[3px] px-3 text-sm transition-colors duration-200 ease-gentle';
const linkIdle =
  'border-transparent font-medium text-foreground hover:bg-surface-muted hover:text-primary-strong';
// Active = a 3px bar + weight + tint, never colour alone (ADR 0023).
const linkCurrent = 'border-primary bg-surface-muted font-semibold text-primary-strong';

/** Active on the link's own page and on its detail pages (`/admin` only on itself). */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));
}

/**
 * The role-filtered groups as one list. Overview is a single top link, not a
 * group of one; the other groups are separated by whitespace and a hairline.
 */
function NavList({ groups }: { groups: AdminNavGroup[] }) {
  const t = useTranslations('adminContent.nav');
  const pathname = usePathname();

  return (
    <ul className="grid gap-5">
      {groups.map((group) => (
        <li
          key={group.id}
          className={group.id === 'overview' ? '' : 'border-t border-border-subtle pt-5'}
        >
          {group.id === 'overview' ? null : (
            <p className="text-eyebrow mb-1 px-3 text-foreground-muted">{t(`groups.${group.id}`)}</p>
          )}
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
  );
}

/**
 * Persistent sidebar from `md` (ADR 0023). Sticky under the top bar and
 * scrolling on its own when taller than the viewport. The groups arrive
 * already filtered by role from the server layout; hiding is not authorization.
 */
export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const t = useTranslations('adminContent.nav');

  return (
    <aside className="hidden w-48 shrink-0 border-r border-border-subtle bg-surface md:block xl:w-64">
      <nav
        aria-label={t('label')}
        className="sticky top-(--admin-bar-h) max-h-[calc(100dvh-var(--admin-bar-h))] overflow-y-auto px-3 py-6 xl:px-4"
      >
        <NavList groups={groups} />
      </nav>
    </aside>
  );
}

/**
 * Phone menu (<768px): a button in the top bar and a panel under it holding
 * the groups, language, View site, the signed-in handle and sign-out. Closes
 * on navigation and on Escape.
 */
export function AdminMobileMenu({ groups, handle, roleLabel }: { groups: AdminNavGroup[]; handle: string; roleLabel: string }) {
  const t = useTranslations('adminContent.nav');
  const pathname = usePathname();
  const menuId = useId();
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  return (
    <div
      className="md:hidden"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) setOpenAt(null);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpenAt(open ? null : pathname)}
        className="inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-4 text-sm font-medium text-foreground"
      >
        {open ? t('closeMenu') : t('openMenu')}
      </button>
      <div
        id={menuId}
        className={`${open ? 'block' : 'hidden'} absolute inset-x-0 top-full max-h-[calc(100dvh-var(--admin-bar-h))] overflow-y-auto border-b border-border-subtle bg-surface px-5 py-4 shadow-lift`}
      >
        <nav aria-label={t('label')}>
          <NavList groups={groups} />
        </nav>
        <div className="mt-5 grid gap-4 border-t border-border-subtle pt-5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong underline underline-offset-4"
          >
            {t('viewSite')}
          </Link>
          <LocaleSwitcher className="justify-self-start" />
          <p className="text-sm text-foreground-muted">
            <span className="font-medium text-foreground">{handle}</span> · {roleLabel}
          </p>
          <AdminSignOut />
        </div>
      </div>
    </div>
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
    <nav aria-label={t('breadcrumb')} className="text-sm text-foreground-muted">
     <Container width="wide">
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
     </Container>
    </nav>
  );
}
