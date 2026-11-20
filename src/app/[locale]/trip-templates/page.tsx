import { cache } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { formatVnd } from '@/lib/format';
import { getDestination } from '@/content/destinations';
import { listPublicTemplates, type PublicTemplateCard } from '@/server/content/public-templates';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { TemplateCard } from '@/components/templates/template-card';
import { TemplatesEmpty, TemplatesError } from '@/components/templates/template-states';

/** Read on every request: a template withdrawn (visibility back to private) disappears at once. */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

type Load = { ok: true; templates: PublicTemplateCard[] } | { ok: false };

/** `cache` dedupes the read between generateMetadata and the page within one request; each request still reads fresh. */
const load = cache(async (): Promise<Load> => {
  try {
    return { ok: true, templates: await listPublicTemplates() };
  } catch (error) {
    // Not swallowed into "empty": the page shows an error. No user data in the log.
    console.error('trip-templates: could not read public templates', error instanceof Error ? error.name : 'error');
    return { ok: false };
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const [t, result] = await Promise.all([getTranslations({ locale, namespace: 'tripTemplates' }), load()]);
  const metadata = buildPageMetadata({ href: '/trip-templates', locale, title: t('metaTitle'), description: t('description') });
  // An empty or failed list is not worth indexing.
  return result.ok && result.templates.length > 0 ? metadata : { ...metadata, robots: { index: false, follow: true } };
}

export default async function TripTemplatesPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tStyle, tPace, tCommon, result] = await Promise.all([
    getTranslations('tripTemplates'),
    getTranslations('travelStyle'),
    getTranslations('pace'),
    getTranslations('common'),
    load(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="wide">
        <section aria-labelledby="templates-results-heading" className="py-10 md:py-14">
          <h2 id="templates-results-heading" className="sr-only">
            {t('resultsHeading')}
          </h2>

          {!result.ok ? (
            <TemplatesError title={t('errorTitle')} body={t('errorBody')} retryLabel={t('retry')} />
          ) : result.templates.length === 0 ? (
            <TemplatesEmpty
              title={t('emptyTitle')}
              body={t('emptyBody')}
              storiesLabel={t('emptyStories')}
              newTripLabel={t('emptyNewTrip')}
            />
          ) : (
            <>
              <p role="status" className="mb-6 text-sm text-foreground-muted">
                {t('count', { count: result.templates.length })}
              </p>
              <ul className="grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 lg:grid-cols-3">
                {result.templates.map((template) => (
                  <li key={template.slug}>
                    <TemplateCard
                      slug={template.slug}
                      labels={{
                        title: template.title[locale],
                        summary: template.summary[locale],
                        duration: tCommon('dayCount', { days: template.durationDays }),
                        style: tStyle(template.travelStyle),
                        pace: tPace(template.pace),
                        group: template.groupSize[locale],
                        cost: `${t('estimated')} ${formatVnd(template.estimatedTotalVnd, locale)}`,
                        destination: template.destinationSlug
                          ? (getDestination(template.destinationSlug)?.name[locale] ?? null)
                          : null,
                        useCta: t('useCta'),
                        useCtaFor: t('useCtaFor', { title: template.title[locale] }),
                        paceLabel: t('paceLabel'),
                        groupLabel: t('groupLabel'),
                        costLabel: t('costLabel'),
                      }}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </Container>
    </>
  );
}
