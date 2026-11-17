import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ContentNotice } from '@/components/admin/content-notice';
import { ContentCreate } from '@/components/admin/content/content-create';

// Reads the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminContent.places' });
  return noIndex(
    buildPageMetadata({
      href: '/admin/content/places/new' as const,
      locale,
      title: t('newMetaTitle'),
      description: t('newDescription'),
    }),
  );
}

/** New place form (P07-16, ADR 0011). The server creates the record; the edit page takes over. */
export default async function AdminNewPlacePage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireStaff(locale, getPathname({ href: '/admin/content/places/new' as const, locale }), 'content');
  const t = await getTranslations('adminContent.places');

  return (
    <>
      <AdminPageHeader title={t('newTitle')} description={t('newDescription')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <ContentNotice />
          <ContentCreate kind="places" />
        </div>
      </Container>
    </>
  );
}
