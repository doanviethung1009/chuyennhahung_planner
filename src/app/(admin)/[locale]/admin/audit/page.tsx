import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AuditFilterForm, AuditTable } from '@/components/admin/audit/audit-table';
import { getPlannerRepository } from '@/server/planner/instance';
import { decodeAuditCursor } from '@/server/planner/repository';

// Reads the session cookie and the live log on every request: never cached.
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminAudit' });
  return noIndex(
    buildPageMetadata({ href: '/admin/audit' as const, locale, title: t('metaTitle'), description: t('description') }),
  );
}

const TYPES = new Set(['trip', 'review', 'user', 'story']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function one(value: string | string[] | undefined): string | undefined {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  return v ? v : undefined;
}

/** Admin audit log (P07-13). `audit:read`: admin and super admin; an editor gets a 404. */
export default async function AdminAuditPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, getPathname({ href: '/admin/audit' as const, locale }), 'audit');
  const t = await getTranslations('adminAudit');

  const raw = await searchParams;
  // Anything malformed is dropped rather than echoed or trusted.
  const actor = one(raw.actor)?.slice(0, 80);
  const targetTypeRaw = one(raw.targetType);
  const actionRaw = one(raw.action);
  const fromRaw = one(raw.from);
  const toRaw = one(raw.to);
  const filters = {
    actor,
    targetType: targetTypeRaw && TYPES.has(targetTypeRaw) ? targetTypeRaw : undefined,
    action: actionRaw && /^[a-z_]{1,40}$/.test(actionRaw) ? actionRaw : undefined,
    from: fromRaw && DATE.test(fromRaw) && !Number.isNaN(Date.parse(fromRaw)) ? fromRaw : undefined,
    to: toRaw && DATE.test(toRaw) && !Number.isNaN(Date.parse(toRaw)) ? toRaw : undefined,
  };
  const dropped =
    (targetTypeRaw && !filters.targetType) || (actionRaw && !filters.action) || (fromRaw && !filters.from) || (toRaw && !filters.to);
  const cursorRaw = one(raw.cursor);

  const repository = await getPlannerRepository();
  const page = await repository.listAuditEvents({
    actor: filters.actor,
    targetType: filters.targetType as 'trip' | 'review' | 'user' | 'story' | undefined,
    action: filters.action,
    from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
    cursor: cursorRaw ? decodeAuditCursor(cursorRaw) : null,
    limit: 50,
  });

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <AuditFilterForm filters={filters} />
          {dropped ? <p role="status">{t('invalid')}</p> : null}
          <AuditTable page={page} filters={filters} locale={locale} />
        </div>
      </Container>
    </>
  );
}
