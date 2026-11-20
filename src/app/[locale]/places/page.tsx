import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { buildPageMetadata } from '@/lib/metadata';
import { searchPublicPlaces } from '@/server/content/public-places';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { PlaceCard } from '@/components/cards/place-card';
import { PlacesFilterForm } from '@/components/places/places-filter-form';
import { PlacesPagination } from '@/components/places/places-pagination';
import { isIndexableList, parsePlacesParams } from '@/components/places/places-list-params';

/** Reads the content store and the query string on every request. */
export const dynamic = 'force-dynamic';

type Raw = string | string[] | undefined;
type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: Raw; destination?: Raw; category?: Raw; page?: Raw }>;
};

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { locale } = await params;
  const list = parsePlacesParams(await searchParams);
  const t = await getTranslations({ locale, namespace: 'placesList' });

  // The canonical is always the bare list, so filtered and paged URLs never compete with it.
  const metadata = buildPageMetadata({ href: '/places', locale, title: t('metaTitle'), description: t('description') });
  return isIndexableList(list) ? metadata : { ...metadata, robots: { index: false, follow: true } };
}

export default async function PlacesPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const list = parsePlacesParams(await searchParams);
  const [t, result] = await Promise.all([
    getTranslations('placesList'),
    searchPublicPlaces({
      ...(list.q ? { q: list.q } : {}),
      ...(list.destination ? { destinationSlug: list.destination } : {}),
      ...(list.category ? { category: list.category } : {}),
      page: list.page,
    }),
  ]);
  const filtered = Boolean(list.q || list.destination || list.category);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')}>
        <PlacesFilterForm params={list} locale={locale} />
      </PageHeader>

      <Container width="wide">
        <section aria-labelledby="places-results-heading" className="py-10 md:py-14">
          <h2 id="places-results-heading" className="sr-only">
            {t('resultsHeading')}
          </h2>
          <p role="status" className="mb-6 text-sm text-foreground-muted">
            {list.q ? t('resultCountFor', { count: result.total, q: list.q }) : t('resultCount', { count: result.total })}
          </p>

          {result.places.length > 0 ? (
            <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {result.places.map((place) => (
                <li key={place.slug}>
                  <PlaceCard place={place} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-border-subtle bg-surface-muted p-8 text-center">
              <h3 className="font-display text-xl font-semibold">{t('emptyTitle')}</h3>
              <p className="mx-auto mt-3 max-w-md text-foreground-muted">{t('emptyBody')}</p>
              {filtered ? (
                <Link
                  href="/places"
                  className="mt-4 inline-flex min-h-11 items-center font-medium text-primary-strong underline-offset-4 hover:underline"
                >
                  {t('clearFilters')}
                </Link>
              ) : null}
            </div>
          )}

          <PlacesPagination params={list} page={result.page} pageCount={result.pageCount} />
        </section>
      </Container>
    </>
  );
}
