import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AdminNavGroup } from '@/lib/admin-gate';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { AdminMobileMenu } from './admin-sidebar';
import { AdminSignOut } from './admin-sign-out';

/**
 * Slim top bar of the admin frame (ADR 0023): brand, View site, language,
 * signed-in handle and role, sign-out. Below `md` it keeps the brand and one
 * Menu button; the account actions move into the menu panel. Only the handle
 * and the role label reach the client.
 */
export async function AdminTopBar({
  groups,
  handle,
  role,
}: {
  groups: AdminNavGroup[];
  handle: string;
  role: 'member' | 'editor' | 'admin' | 'super_admin';
}) {
  const t = await getTranslations('adminContent.nav');
  const ta = await getTranslations('admin');
  const roleLabel = ta(`roles.${role}`);

  return (
    <header className="sticky top-0 z-40 flex h-(--admin-bar-h) items-center justify-between gap-4 border-b border-border-subtle bg-surface px-4 md:px-6">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center whitespace-nowrap font-display text-base font-semibold text-foreground md:text-lg"
      >
        {t('brand')}
      </Link>
      <div className="hidden items-center gap-4 md:flex">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-medium text-primary-strong underline underline-offset-4"
        >
          {t('viewSite')}
        </Link>
        <LocaleSwitcher />
        <p className="text-sm whitespace-nowrap text-foreground-muted">
          <span className="font-medium text-foreground">{handle}</span>
          <span className="hidden lg:inline"> · {roleLabel}</span>
        </p>
        <AdminSignOut />
      </div>
      <AdminMobileMenu groups={groups} handle={handle} roleLabel={roleLabel} />
    </header>
  );
}
