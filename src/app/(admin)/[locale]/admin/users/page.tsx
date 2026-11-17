import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminConsole } from '@/components/admin/admin-console';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  const tn = await getTranslations({ locale, namespace: 'adminContent.nav' });
  return noIndex(
    buildPageMetadata({
      href: '/admin/users' as const,
      locale,
      title: tn('users'),
      description: t('shellDescription'),
    }),
  );
}

/**
 * The user console (ADR 0010), moved unchanged from `/admin` (ADR 0020).
 * `user:provision` only: an editor gets a plain 404, like any other page
 * they cannot use.
 */
export default async function AdminUsersPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireStaff(locale, getPathname({ href: '/admin/users' as const, locale }), 'users');
  const t = await getTranslations('admin');
  const tn = await getTranslations('adminContent.nav');

  return (
    <>
      <AdminPageHeader title={tn('users')} description={t('shellDescription')} />
      <Container width="wide">
        <div className="grid gap-10 py-10 md:py-14">
          <AdminConsole currentUserId={access.principal.userId} actorRole={access.principal.role} />
        </div>
      </Container>
    </>
  );
}
