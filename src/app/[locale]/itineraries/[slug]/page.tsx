import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { siteConfig } from '@/content/site';
import { getItinerary, itineraries } from '@/content/itineraries';
import { getDestination } from '@/content/destinations';
import { formatVnd } from '@/lib/format';
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { JsonLd } from '@/components/seo/json-ld';

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return itineraries.map((itinerary) => ({ slug: itinerary.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const itinerary = getItinerary(slug);
  if (!itinerary) return {};

  return buildPageMetadata({
    href: { pathname: '/itineraries/[slug]', params: { slug } },
    locale,
    title: itinerary.title[locale],
    description: itinerary.summary[locale],
    image: itinerary.cover,
  });
}

export default async function ItineraryPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const itinerary = getItinerary(slug);
  if (!itinerary) notFound();

  const [t, tCommon, tPace, tPlan] = await Promise.all([
    getTranslations('itineraries'),
    getTranslations('common'),
    getTranslations('pace'),
    getTranslations('plan'),
  ]);

  const places = itinerary.destinationSlugs
    .map(getDestination)
    .filter((d) => d !== undefined);

  return (
    <article>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TouristTrip',
          name: itinerary.title[locale],
          description: itinerary.summary[locale],
          inLanguage: locale,
          image: new URL(itinerary.cover, siteConfig.url).toString(),
          touristType: itinerary.bestFor[locale],
          itinerary: {
            '@type': 'ItemList',
            numberOfItems: itinerary.dayByDay.length,
            itemListElement: itinerary.dayByDay.map((day) => ({
              '@type': 'ListItem',
              position: day.day,
              name: day.title[locale],
              description: day.detail[locale],
            })),
          },
          // Deliberately no `offers`: these are trips we travelled and the
          // price is what we spent, not something for sale. Emitting an Offer
          // would put a purchasable price into search results.
        }}
      />

      <div className="relative h-[15rem] w-full overflow-hidden md:h-[22rem]">
        <CoverImage src={itinerary.cover} alt="" priority sizes="100vw" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ink-900/75 to-transparent"
        />
      </div>

      <Container width="wide">
        <div className="relative -mt-20 rounded-2xl bg-surface p-6 shadow-lift md:-mt-24 md:p-10">
          <Link
            href="/itineraries"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-strong"
          >
            <span aria-hidden="true">←</span>
            {tCommon('backToList')}
          </Link>

          <h1 className="mt-4 font-display text-[2rem] leading-[1.12] font-semibold tracking-tight md:text-[2.75rem]">
            {itinerary.title[locale]}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-foreground-muted">
            {itinerary.summary[locale]}
          </p>

          <ul className="mt-6 flex list-none flex-wrap gap-2 p-0">
            <li>
              <Badge tone="primary">
                {tCommon('dayCount', { days: itinerary.days })}
              </Badge>
            </li>
            <li>
              <Badge tone="primary">
                {tCommon('nightCount', { nights: itinerary.nights })}
              </Badge>
            </li>
            <li>
              <Badge tone="accent">{tPace(itinerary.pace)}</Badge>
            </li>
            {places.map((place) => (
              <li key={place.slug}>
                <Link
                  href={{
                    pathname: '/destinations/[slug]',
                    params: { slug: place.slug },
                  }}
                  className="inline-flex min-h-11 items-center"
                >
                  <Badge>{place.name[locale]}</Badge>
                </Link>
              </li>
            ))}
          </ul>

          <dl className="mt-8 grid gap-6 border-t border-border-subtle pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-eyebrow text-foreground-muted">
                {tCommon('from')}
              </dt>
              <dd className="mt-2 font-display text-2xl font-semibold text-primary-strong">
                {formatVnd(itinerary.priceFromVnd, locale)}
                <span className="text-base font-normal text-foreground-muted">
                  {tCommon('perPerson')}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow text-foreground-muted">
                {t('groupSize')}
              </dt>
              <dd className="mt-2 text-base text-ink-800">
                {itinerary.groupSize[locale]}
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow text-foreground-muted">
                {t('bestFor')}
              </dt>
              <dd className="mt-2 text-base text-ink-800">
                {itinerary.bestFor[locale]}
              </dd>
            </div>
          </dl>
        </div>
      </Container>

      <Container width="default">
        <div className="grid gap-12 py-12 md:py-16 lg:grid-cols-12 lg:gap-14">
          <section aria-labelledby="day-by-day-heading" className="lg:col-span-7">
            <h2
              id="day-by-day-heading"
              className="font-display text-2xl font-semibold md:text-3xl"
            >
              {t('dayByDay')}
            </h2>

            <ol className="mt-8 flex list-none flex-col gap-8 p-0">
              {itinerary.dayByDay.map((day) => (
                <li key={day.day} className="relative flex gap-5">
                  <div className="flex flex-col items-center">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary font-display text-sm font-semibold text-primary-foreground">
                      {day.day}
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-2 w-px flex-1 bg-border"
                    />
                  </div>
                  <div className="pb-2">
                    <h3 className="font-display text-xl font-semibold">
                      <span className="sr-only">
                        {t('dayLabel', { day: day.day })} —{' '}
                      </span>
                      {day.title[locale]}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-foreground-muted">
                      {day.detail[locale]}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="lg:col-span-5">
            <div className="rounded-2xl bg-surface-muted p-6 md:p-8">
              <h2 className="font-display text-xl font-semibold">
                {t('highlights')}
              </h2>
              <ul className="mt-5 flex list-none flex-col gap-4 p-0">
                {itinerary.highlights[locale].map((highlight) => (
                  <li key={highlight} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-pill bg-primary"
                    />
                    <span className="text-base leading-relaxed text-ink-800">
                      {highlight}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-8 border-t border-border pt-5 text-sm text-foreground-muted">
                {t('priceNote')}
              </p>

              <div className="mt-6">
                <ButtonLink href="/plan-your-trip" size="lg" className="w-full">
                  {tPlan('title')}
                </ButtonLink>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </article>
  );
}
