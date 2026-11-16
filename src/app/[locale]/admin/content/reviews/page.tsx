import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { ContentNotice } from '@/components/admin/content-notice';
import { ReviewQueue } from '@/components/admin/content/review-queue';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminContent.reviews' });
  return noIndex(
    buildPageMetadata({
      href: '/admin/content/reviews' as const,
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
  );
}

/** Review moderation queue (ADR 0011). */
export default async function AdminReviewsPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireStaff(locale, getPathname({ href: '/admin/content/reviews' as const, locale }), 'content');
  const t = await getTranslations('adminContent.reviews');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <ContentNotice />
          <ReviewQueue />
        </div>
      </Container>
    </>
  );
}
