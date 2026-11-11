import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname, redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { AdminConsole } from '@/components/admin/admin-console';
import { readAdminPageAccess } from '@/server/planner/admin-page';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return {
    ...buildPageMetadata({
      href: '/admin',
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * Admin portal, slice 1 (ADR 0010). The server decides who may see anything:
 * anonymous visitors go to sign-in and come back, an admin on a temporary
 * password goes to change it, and everyone else gets a plain 404 so the page
 * does not advertise itself. Only then is the client island rendered.
 */
export default async function AdminPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await readAdminPageAccess();
  const returnTo = getPathname({ href: '/admin', locale });
  if (access.status === 'anonymous') {
    redirect({ href: { pathname: '/sign-in', query: { returnTo } }, locale });
  }
  if (access.status === 'must-change-password') {
    redirect({ href: { pathname: '/account/password', query: { returnTo } }, locale });
  }
  if (access.status !== 'admin') notFound();

  const t = await getTranslations('admin');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="py-10 md:py-14">
          <AdminConsole currentUserId={access.principal.userId} currentHandle={access.principal.handle} />
        </div>
      </Container>
    </>
  );
}
