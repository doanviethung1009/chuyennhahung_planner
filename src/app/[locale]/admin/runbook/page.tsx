import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { noIndex, requireStaff } from '@/lib/admin-gate';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { Markdown } from '@/components/runbook/markdown';
import {
  DEFAULT_RUNBOOK_DOC,
  RUNBOOK_DOCS,
  documentTitle,
  isCoreRunbookDoc,
  knownRunbookDocs,
  listFeatureSlugs,
  readRunbookDoc,
  resolveRunbookDoc,
} from '@/server/runbook/docs';

const linkBase =
  'inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium transition-colors duration-200 ease-gentle';
const linkIdle = 'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary-strong';
const linkCurrent = 'border-primary bg-surface-muted text-primary-strong';

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

/** Super-admin-only runbook: the API list and the operations guides, read from `docs/`. */
export default async function AdminRunbookPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  // `runbook:read` = super admin only (ADR 0017); admins and editors get a 404.
  await requireStaff(locale, getPathname({ href: '/admin/runbook' as const, locale }), 'runbook');
  const t = await getTranslations('adminRunbook');

  const raw = (await searchParams).doc;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const current = (await resolveRunbookDoc(requested)) ?? DEFAULT_RUNBOOK_DOC;
  const source = await readRunbookDoc(current, locale);
  const known = await knownRunbookDocs();
  const featureSlugs = await listFeatureSlugs();
  const featureTitles = await Promise.all(
    featureSlugs.map(async (slug) => ({
      id: `features/${slug}`,
      title: documentTitle(await readRunbookDoc(`features/${slug}`, locale), slug),
    })),
  );
  const isFeature = !isCoreRunbookDoc(current);
  const currentTitle = isCoreRunbookDoc(current)
    ? t(`docs.${current}`)
    : (featureTitles.find((f) => f.id === current)?.title ?? current);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <div className="grid gap-8 py-10 md:py-14">
          <nav aria-label={t('docsLabel')} className="flex flex-wrap items-center gap-2">
            {RUNBOOK_DOCS.map((doc) => (
              <Link
                key={doc}
                href={{ pathname: '/admin/runbook', query: { doc } }}
                aria-current={doc === current ? 'page' : undefined}
                className={`${linkBase} ${doc === current ? linkCurrent : linkIdle}`}
              >
                {t(`docs.${doc}`)}
              </Link>
            ))}
          </nav>
          {featureTitles.length > 0 ? (
            <details open={isFeature} className="rounded-md border border-border-subtle p-4">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                {t('featuresSummary', { count: featureTitles.length })}
              </summary>
              <nav aria-label={t('featuresLabel')} className="mt-3 flex flex-wrap items-center gap-2">
                {featureTitles.map(({ id, title }) => (
                  <Link
                    key={id}
                    href={{ pathname: '/admin/runbook', query: { doc: id } }}
                    aria-current={id === current ? 'page' : undefined}
                    className={`${linkBase} ${id === current ? linkCurrent : linkIdle}`}
                  >
                    {title}
                  </Link>
                ))}
              </nav>
            </details>
          ) : null}
          <article aria-label={currentTitle} className="max-w-5xl">
            {source ? (
              <Markdown
                source={source}
                tableLabel={t('tableLabel')}
                base={isFeature ? 'features' : ''}
                known={known}
              />
            ) : (
              <p role="status">{t('missing')}</p>
            )}
          </article>
        </div>
      </Container>
    </>
  );
}
