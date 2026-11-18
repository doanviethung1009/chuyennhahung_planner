import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ROLE_ACTIONS, canManageRole } from '@/server/identity/permissions';
import { RolesMatrix } from '@/components/admin/roles-matrix';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminRoles' });
  return noIndex(
    buildPageMetadata({ href: '/admin/users/roles' as const, locale, title: t('metaTitle'), description: t('description') }),
  );
}

/** Read-only role matrix (P07-12). `user:provision` only, like the user console. */
export default async function AdminRolesPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, getPathname({ href: '/admin/users/roles' as const, locale }), 'users');
  const t = await getTranslations('adminRoles');

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link
            href="/admin/users"
            className="inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-4 text-sm font-medium hover:border-primary hover:text-primary-strong"
          >
            {t('backToUsers')}
          </Link>
        }
      />
      <Container width="wide">
        <div className="py-10 md:py-14">
          <RolesMatrix roleActions={ROLE_ACTIONS} canManage={canManageRole} />
        </div>
      </Container>
    </>
  );
}
