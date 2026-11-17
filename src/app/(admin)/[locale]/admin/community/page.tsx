import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ListingQueue } from '@/components/admin/community/listing-queue';
import { CommunityReviewQueue } from '@/components/admin/community/review-queue';
import { RestrictionList } from '@/components/admin/community/restriction-list';
import { can } from '@/server/identity/permissions';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminCommunity' });
  return noIndex(
    buildPageMetadata({
      href: '/admin/community' as const,
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
  );
}

/** Community trip moderation queue (ADR 0014). */
export default async function AdminCommunityPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireStaff(locale, getPathname({ href: '/admin/community' as const, locale }), 'content');
  const t = await getTranslations('adminCommunity');
  const canRestrict = can(access.principal, 'community:restrict');

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <section aria-labelledby="queue-trips-heading" className="grid gap-4">
            <h2 id="queue-trips-heading" className="font-display text-2xl font-semibold">
              {t('tripsHeading')}
            </h2>
            <ListingQueue />
          </section>
          <section aria-labelledby="queue-reviews-heading" className="grid gap-4">
            <h2 id="queue-reviews-heading" className="font-display text-2xl font-semibold">
              {t('reviewsHeading')}
            </h2>
            <CommunityReviewQueue canRestrict={canRestrict} />
          </section>
          {canRestrict ? (
            <section aria-labelledby="queue-restrictions-heading" className="grid gap-4">
              <h2 id="queue-restrictions-heading" className="font-display text-2xl font-semibold">
                {t('restrictionsHeading')}
              </h2>
              <RestrictionList />
            </section>
          ) : null}
        </div>
      </Container>
    </>
  );
}
