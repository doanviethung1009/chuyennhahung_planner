import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ContentNotice } from '@/components/admin/content-notice';
import { CollectionEditor } from '@/components/admin/content/collection-editor';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'adminContent.collections' });
  return noIndex(
    buildPageMetadata({
      href: { pathname: '/admin/content/collections/[slug]', params: { slug } } as const,
      locale,
      title: t('editMetaTitle'),
      description: t('editDescription'),
    }),
  );
}

/** Collection editor (P07-15). The record is fetched by the client island so there is one read and write path. */
export default async function AdminCollectionEditPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  await requireStaff(locale, getPathname({ href: { pathname: '/admin/content/collections/[slug]', params: { slug } } as const, locale }), 'content');
  const t = await getTranslations('adminContent.collections');

  return (
    <>
      <AdminPageHeader title={t('editTitle')} description={t('editDescription')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <ContentNotice />
          <CollectionEditor slug={slug} />
        </div>
      </Container>
    </>
  );
}
