import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { adminSidebarGroups } from '@/lib/admin-gate';
import { readStaffPageAccess } from '@/server/planner/admin-page';
import { AdminBreadcrumb, AdminSidebar } from '@/components/admin/admin-sidebar';

// Reads the session cookie: never prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * One frame for every admin page (ADR 0020): skip link, grouped sidebar,
 * breadcrumb. The layout never redirects or 404s — each page keeps its own
 * `requireStaff` gate with its own `returnTo`; when the visitor is not staff
 * the page redirects or 404s and the frame is simply not drawn. The access
 * read is `cache()`d, so it runs once per request.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await readStaffPageAccess();
  if (access.status !== 'staff') return <>{children}</>;

  const t = await getTranslations('adminContent.nav');
  const groups = adminSidebarGroups(access.principal);

  return (
    <div className="flex flex-col lg:flex-row">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:text-foreground"
      >
        {t('skip')}
      </a>
      <AdminSidebar groups={groups} />
      <div id="admin-content" className="min-w-0 flex-1">
        <AdminBreadcrumb groups={groups} />
        {children}
      </div>
    </div>
  );
}
