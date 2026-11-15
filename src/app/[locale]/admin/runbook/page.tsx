import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Markdown } from '@/components/runbook/markdown';
import { DEFAULT_RUNBOOK_DOC, RUNBOOK_DOCS, isRunbookDoc, readRunbookDoc } from '@/server/runbook/docs';

// Gated by the session cookie on every request: never prerendered or cached.
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ doc?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminRunbook' });
  return noIndex(
    buildPageMetadata({
      href: '/admin/runbook' as const,
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
  );
}

/** Admin-only runbook: the API list and the operations guides, read from `docs/`. */
export default async function AdminRunbookPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  // `users` = `user:provision` = admin (and the service principal); editors get a 404.
  const access = await requireStaff(locale, getPathname({ href: '/admin/runbook' as const, locale }), 'users');
  const t = await getTranslations('adminRunbook');

  const raw = (await searchParams).doc;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const current = isRunbookDoc(requested) ? requested : DEFAULT_RUNBOOK_DOC;
  const source = await readRunbookDoc(current, locale);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <AdminNav current="runbook" canUsers={access.canUsers} canContent={access.canContent} />
          <nav aria-label={t('docsLabel')} className="flex flex-wrap items-center gap-2">
            {RUNBOOK_DOCS.map((doc) => (
              <Link
                key={doc}
                href={{ pathname: '/admin/runbook', query: { doc } }}
                aria-current={doc === current ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium transition-colors duration-200 ease-gentle ${
                  doc === current
                    ? 'border-primary bg-surface-muted text-primary-strong'
                    : 'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary-strong'
                }`}
              >
                {t(`docs.${doc}`)}
              </Link>
            ))}
          </nav>
          <article aria-label={t(`docs.${current}`)} className="max-w-5xl">
            {source ? (
              <Markdown source={source} tableLabel={t('tableLabel')} />
            ) : (
              <p role="status">{t('missing')}</p>
            )}
          </article>
        </div>
      </Container>
    </>
  );
}
