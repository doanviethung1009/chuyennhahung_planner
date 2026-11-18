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
import { ReportQueue } from '@/components/admin/community/report-queue';
import { RestrictionList } from '@/components/admin/community/restriction-list';
import { ModerationWorkspace, WorkspaceNav } from '@/components/admin/community/workspace';
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
    <ModerationWorkspace>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <WorkspaceNav canRestrict={canRestrict} />
      <Container width="wide">
        {/* Fixed triage order: trips, pending reviews, held reviews, reports, restrictions. */}
        <div className="grid gap-10 py-10 md:py-14">
          <ListingQueue />
          <CommunityReviewQueue canRestrict={canRestrict} canErase={can(access.principal, 'community:erase')} />
          <ReportQueue />
          {canRestrict ? <RestrictionList /> : null}
        </div>
      </Container>
    </ModerationWorkspace>
  );
}
