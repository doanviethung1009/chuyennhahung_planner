import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SystemStatusView } from '@/components/admin/system/system-status';
import { loadSystemStatus } from '@/server/admin/system';

// Gated by the session cookie and reads live state: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminSystem' });
  return noIndex(
    buildPageMetadata({ href: '/admin/system' as const, locale, title: t('metaTitle'), description: t('description') }),
  );
}

/** Super-admin-only system status (P07-17). `runbook:read`; admins and editors get a 404. */
export default async function AdminSystemPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, getPathname({ href: '/admin/system' as const, locale }), 'runbook');
  const t = await getTranslations('adminSystem');
  const status = await loadSystemStatus();

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link
            href="/admin/runbook"
            className="inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-4 text-sm font-medium hover:border-primary hover:text-primary-strong"
          >
            {t('runbookLink')}
          </Link>
        }
      />
      <Container width="wide">
        <div className="py-10 md:py-14">
          <SystemStatusView status={status} />
        </div>
      </Container>
    </>
  );
}
