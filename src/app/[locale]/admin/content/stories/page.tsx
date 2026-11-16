import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { ContentNotice } from '@/components/admin/content-notice';
import { ContentList } from '@/components/admin/content/content-list';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminContent.stories' });
  return noIndex(
    buildPageMetadata({
      href: '/admin/content/stories' as const,
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
  );
}

/** Stories index (ADR 0011). */
export default async function AdminStoriesPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireStaff(locale, getPathname({ href: '/admin/content/stories' as const, locale }), 'content');
  const t = await getTranslations('adminContent.stories');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <ContentNotice />
          <ContentList kind="stories" />
        </div>
      </Container>
    </>
  );
}
