import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import type { Destination } from '@/content/types';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { DestinationCard } from '@/components/cards/destination-card';

type Params = { params: Promise<{ locale: Locale }> };

const regions = ['north', 'central', 'south'] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'destinations' });

  return buildPageMetadata({
    href: '/destinations',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

/**
 * Grouped by region with an in-page jump nav rather than a JavaScript filter:
 * every group stays crawlable, linkable and usable without hydration.
 */
export default async function DestinationsPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tRegion] = await Promise.all([
    getTranslations('destinations'),
    getTranslations('region'),
  ]);

  const grouped = regions
    .map((region) => ({
      region,
      items: destinations.filter((d: Destination) => d.region === region),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={
          <p className="text-sm text-foreground-muted">
            {t('count', { count: destinations.length })}
          </p>
        }
      >
        <nav aria-label={t('filterLabel')}>
          <ul className="flex list-none flex-wrap gap-2 p-0">
            {grouped.map(({ region, items }) => (
              <li key={region}>
                <a
                  href={`#region-${region}`}
                  className="inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-4 text-sm font-medium text-ink-700 transition-colors duration-200 ease-gentle hover:border-primary hover:text-primary-strong"
                >
                  {tRegion(region)}
                  <span className="ml-2 text-foreground-muted">{items.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <Container width="wide">
        <div className="flex flex-col gap-14 py-12 md:gap-20 md:py-16">
          {grouped.map(({ region, items }) => (
            <section
              key={region}
              id={`region-${region}`}
              aria-labelledby={`region-${region}-heading`}
              className="scroll-mt-24"
            >
              <h2
                id={`region-${region}-heading`}
                className="mb-6 font-display text-2xl font-semibold md:text-3xl"
              >
                {tRegion(region)}
              </h2>
              <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((destination) => (
                  <li key={destination.slug}>
                    <DestinationCard destination={destination} locale={locale} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
