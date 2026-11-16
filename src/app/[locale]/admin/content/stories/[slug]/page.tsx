import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { ContentNotice } from '@/components/admin/content-notice';
import { StoryEditor } from '@/components/admin/content/story-editor';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'adminContent.stories' });
  return noIndex(
    buildPageMetadata({
      href: { pathname: '/admin/content/stories/[slug]', params: { slug } } as const,
      locale,
      title: t('editMetaTitle'),
      description: t('editDescription'),
    }),
  );
}

/** Story editor (ADR 0011). The record is fetched by the client island so there is one read and write path. */
export default async function AdminStoryEditPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  await requireStaff(locale, getPathname({ href: { pathname: '/admin/content/stories/[slug]', params: { slug } } as const, locale }), 'content');
  const t = await getTranslations('adminContent.stories');

  return (
    <>
      <PageHeader title={t('editTitle')} description={t('editDescription')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <ContentNotice />
          <StoryEditor slug={slug} />
        </div>
      </Container>
    </>
  );
}
