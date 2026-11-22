import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import { provincesWithDestinations } from '@/content/provinces';
import { parseDestinationProvince } from '@/lib/destinations-filter';
import type { Destination } from '@/content/types';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { DestinationCard } from '@/components/cards/destination-card';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ province?: string | string[] }>;
};

const regions = ['north', 'central', 'south'] as const;

const chipClass = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium transition-colors duration-200 ease-gentle ${
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border-strong bg-surface text-ink-700 hover:border-primary hover:text-primary-strong'
  }`;

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { locale } = await params;
  const province = parseDestinationProvince((await searchParams).province);
  const t = await getTranslations({ locale, namespace: 'destinations' });

  // The canonical is always the bare list, so a filtered URL never competes with it.
  const metadata = buildPageMetadata({
    href: '/destinations',
    locale,
    title: t('title'),
    description: t('description'),
  });
  return province ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

/**
 * Grouped by region with an in-page jump nav rather than a JavaScript filter:
 * every group stays crawlable, linkable and usable without hydration. The province
 * filter follows the same idea — plain links to `?province=`, rendered on the server.
 */
export default async function DestinationsPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const province = parseDestinationProvince((await searchParams).province);
  const visible = province ? destinations.filter((d) => d.provinceSlug === province) : destinations;

  const [t, tRegion, tPlaces] = await Promise.all([
    getTranslations('destinations'),
    getTranslations('region'),
    getTranslations('placesList'),
  ]);

  const grouped = regions
    .map((region) => ({
      region,
      items: visible.filter((d: Destination) => d.region === region),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <p className="text-sm text-foreground-muted">
              {t('count', { count: visible.length })}
            </p>
            <Link
              href="/places"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-strong"
            >
              {tPlaces('browseAll')}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        }
      >
        <nav aria-label={t('provinceFilterLabel')} className="mb-3">
          <ul className="flex list-none flex-wrap gap-2 p-0">
            <li>
              <Link href="/destinations" aria-current={province ? undefined : 'true'} className={chipClass(!province)}>
                {t('allProvinces')}
              </Link>
            </li>
            {provincesWithDestinations.map((p) => (
              <li key={p.slug}>
                <Link
                  href={{ pathname: '/destinations', query: { province: p.slug } }}
                  aria-current={province === p.slug ? 'true' : undefined}
                  className={chipClass(province === p.slug)}
                >
                  {p.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
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
