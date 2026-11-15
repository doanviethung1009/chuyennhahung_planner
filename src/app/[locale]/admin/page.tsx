import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { AdminConsole } from '@/components/admin/admin-console';
import { AdminNav } from '@/components/admin/admin-nav';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return noIndex(
    buildPageMetadata({
      href: '/admin',
      locale,
      title: t('metaTitle'),
      description: t('shellDescription'),
    }),
  );
}

/**
 * Admin shell (ADR 0010, ADR 0011 §5). The server decides who may see anything:
 * anonymous visitors go to sign-in and come back, a user on a temporary
 * password goes to change it, and a role with nothing to do here gets a plain
 * 404. Editors see the Content section only; admins also see Users. Only then
 * are the client islands rendered.
 */
export default async function AdminPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireStaff(locale, getPathname({ href: '/admin', locale }));
  const t = await getTranslations('admin');
  const tc = await getTranslations('adminContent.overview');

  return (
    <>
      <PageHeader title={t('title')} description={t('shellDescription')} />
      <Container width="wide">
        <div className="grid gap-10 py-10 md:py-14">
          <AdminNav current="overview" canUsers={access.canUsers} canRunbook={access.canRunbook} canContent={access.canContent} />
          {access.canUsers ? (
            <AdminConsole currentUserId={access.principal.userId} actorRole={access.principal.role} currentHandle={access.principal.handle} />
          ) : (
            <section aria-labelledby="admin-overview-heading" className="grid gap-4">
              <h2 id="admin-overview-heading" className="font-display text-2xl text-foreground">
                {tc('heading')}
              </h2>
              <p className="text-base text-foreground-muted">{tc('signedInAs', { handle: access.principal.handle })}</p>
              <p className="text-base text-foreground-muted">{tc('body')}</p>
              <div>
                <Link
                  href="/admin/content/stories"
                  className="inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4"
                >
                  {tc('goStories')}
                </Link>
              </div>
            </section>
          )}
        </div>
      </Container>
    </>
  );
}
