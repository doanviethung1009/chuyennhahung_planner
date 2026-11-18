import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ContentNotice } from '@/components/admin/content-notice';
import { IntegrityReport } from '@/components/admin/content/integrity-report';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminContent.integrity' });
  return noIndex(
    buildPageMetadata({
      href: '/admin/content/integrity' as const,
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
  );
}

/**
 * Read-only integrity report (P07-15). Editors see the content report; the
 * Planner report names user and trip ids and is shown to `user:provision` only.
 */
export default async function AdminIntegrityPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { canUsers } = await requireStaff(locale, getPathname({ href: '/admin/content/integrity' as const, locale }), 'content');
  const t = await getTranslations('adminContent.integrity');

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <ContentNotice />
          <IntegrityReport showPlanner={canUsers} />
        </div>
      </Container>
    </>
  );
}
