import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { OverviewCards } from '@/components/admin/dashboard/overview-cards';
import { loadOverview } from '@/server/admin/overview';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const tc = await getTranslations({ locale, namespace: 'adminContent.overview' });
  return noIndex(
    buildPageMetadata({
      href: '/admin',
      locale,
      title: tc('metaTitle'),
      description: tc('description'),
    }),
  );
}

/**
 * Admin dashboard (ADR 0020, P07-11): counts per role, each card linking to its
 * screen. A failing source degrades its own card. The server gate is unchanged: anonymous visitors go to sign-in
 * and come back, a temporary password goes to change it, a role with nothing
 * to do here gets a plain 404. The user console moved to `/admin/users`.
 */
export default async function AdminPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireStaff(locale, getPathname({ href: '/admin', locale }));
  const tc = await getTranslations('adminContent.overview');
  const overview = await loadOverview(access.principal);

  return (
    <>
      <AdminPageHeader title={tc('title')} description={tc('description')} />
      <Container width="wide">
        <div className="grid gap-10 py-10 md:py-14">
          <section aria-labelledby="admin-cards-heading" className="grid gap-4">
            <h2 id="admin-cards-heading" className="font-display text-2xl text-foreground">
              {tc('cardsHeading')}
            </h2>
            <OverviewCards overview={overview} />
          </section>
          <section aria-labelledby="admin-overview-heading" className="grid gap-4">
            <h2 id="admin-overview-heading" className="font-display text-2xl text-foreground">
              {tc('heading')}
            </h2>
            <p className="text-base text-foreground-muted">{tc('signedInAs', { handle: access.principal.handle })}</p>
            <p className="text-base text-foreground-muted">{tc('body')}</p>
            {access.canContent ? (
              <div>
                <Link
                  href="/admin/content/stories"
                  className="inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4"
                >
                  {tc('goStories')}
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </Container>
    </>
  );
}
