import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import { isVisited } from '@/content/types';
import { parseDestinationProvince } from '@/lib/destinations-filter';
import { ProvinceFilterNav } from '@/components/ui/province-filter-nav';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { VietnamMap } from '@/components/map/vietnam-map';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ province?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { locale } = await params;
  const province = parseDestinationProvince((await searchParams).province);
  const t = await getTranslations({ locale, namespace: 'map' });

  // The canonical is always the bare map, so a filtered URL never competes with it.
  const metadata = buildPageMetadata({
    href: '/map',
    locale,
    title: t('title'),
    description: t('description'),
  });
  return province ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function MapPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const province = parseDestinationProvince((await searchParams).province);
  const visible = province ? destinations.filter((d) => d.provinceSlug === province) : destinations;

  const [t, tRegion, tCommon, tDest] = await Promise.all([
    getTranslations('map'),
    getTranslations('region'),
    getTranslations('common'),
    getTranslations('destinations'),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')}>
        <ProvinceFilterNav
          basePath="/map"
          active={province}
          locale={locale}
          label={tDest('provinceFilterLabel')}
          allLabel={tDest('allProvinces')}
        />
      </PageHeader>

      <Container width="wide">
        <div className="grid gap-12 py-12 md:py-16 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-surface-muted p-6 md:p-8">
              <VietnamMap
                destinations={visible}
                locale={locale}
                mapLabel={t('mapLabel')}
              />
            </div>
            <div className="mt-5 rounded-xl border border-border-subtle p-4">
              <h2 className="text-eyebrow text-foreground-muted">
                {t('legend')}
              </h2>
              <p className="mt-2 flex items-center gap-3 text-sm text-foreground-muted">
                <span
                  aria-hidden="true"
                  className="inline-block size-3 shrink-0 rounded-pill border-2 border-cream-50 bg-primary shadow-soft"
                />
                {t('legendVisits')}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-foreground-muted">
                <span
                  aria-hidden="true"
                  className="inline-block size-3 shrink-0 rounded-pill border-2 border-primary bg-cream-50"
                />
                {t('legendNotVisited')}
              </p>
              <p className="mt-2 flex items-start gap-2 text-sm text-foreground-muted">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-block shrink-0 rounded-pill bg-cream-50/90 px-2 text-xs font-semibold leading-5 text-ink-800 shadow-soft"
                >
                  Aa
                </span>
                {t('legendNames')}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              {t('listTitle')}
            </h2>
            <p className="mt-2 text-base text-foreground-muted">
              {t('selectHint')}
            </p>

            <ul className="mt-6 flex list-none flex-col gap-1 p-0">
              {visible.map((destination) => (
                <li key={destination.slug}>
                  <Link
                    href={{
                      pathname: '/destinations/[slug]',
                      params: { slug: destination.slug },
                    }}
                    className="group flex min-h-16 items-center justify-between gap-4 rounded-xl border-b border-border-subtle px-3 py-3 transition-colors duration-200 ease-gentle hover:bg-surface-muted"
                  >
                    <span>
                      <span className="block font-display text-lg font-semibold text-ink-900">
                        {destination.name[locale]}
                      </span>
                      <span className="mt-0.5 block text-sm text-foreground-muted">
                        {destination.area[locale]} · {tRegion(destination.region)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-foreground-muted">
                      {isVisited(destination)
                        ? tCommon('visitCount', { count: destination.visits })
                        : tCommon('notVisited')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </>
  );
}
