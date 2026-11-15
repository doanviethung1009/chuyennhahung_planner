import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { siteConfig } from '@/content/site';
import { getDestination } from '@/content/destinations';
import { getPublicContent } from '@/server/content/public';
import { getApprovedReviews, getReviewPlaces } from '@/server/community/public';
import { ReviewList } from '@/components/reviews/review-list';
import { getItinerariesForDestination } from '@/content/itineraries';
import { formatDate } from '@/lib/format';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { Badge } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover-image';
import { StoryCard } from '@/components/cards/story-card';
import { ItineraryCard } from '@/components/cards/itinerary-card';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale; slug: string }> };


export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const destination = getDestination(slug);
  if (!destination) return {};

  return buildPageMetadata({
    href: { pathname: '/destinations/[slug]', params: { slug } },
    locale,
    title: destination.name[locale],
    description: destination.summary[locale],
    image: destination.cover,
  });
}

export default async function DestinationPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const destination = getDestination(slug);
  if (!destination) notFound();

  const [t, tRegion] = await Promise.all([
    getTranslations('common'),
    getTranslations('region'),
  ]);

  const relatedStories = await (await getPublicContent()).listStoriesForDestination(slug);
  const relatedItineraries = getItinerariesForDestination(slug);

  // Traveller reviews of this destination's places (ADR 0014): approved only.
  const destinationPlaces = (await getReviewPlaces()).filter((place) => place.destinationSlug === slug);
  const destinationReviews =
    destinationPlaces.length > 0
      ? await getApprovedReviews(destinationPlaces.map((place) => place.slug), 6)
      : { items: [], summary: { count: 0, average: null } };
  const tReviews = await getTranslations('communityReviews');

  return (
    <article>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TouristDestination',
          name: destination.name[locale],
          description: destination.summary[locale],
          inLanguage: locale,
          image: new URL(destination.cover, siteConfig.url).toString(),
          geo: {
            '@type': 'GeoCoordinates',
            latitude: destination.coords.lat,
            longitude: destination.coords.lng,
          },
          address: {
            '@type': 'PostalAddress',
            addressRegion: destination.area[locale],
            addressCountry: 'VN',
          },
        }}
      />

      <div className="relative">
        <div className="relative h-[16rem] w-full overflow-hidden md:h-[24rem] lg:h-[28rem]">
          <CoverImage
            src={destination.cover}
            alt=""
            priority
            sizes="100vw"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/25 to-transparent"
          />
        </div>

        <Container width="wide">
          <div className="relative -mt-24 rounded-2xl bg-surface p-6 shadow-lift md:-mt-28 md:p-10">
            <Link
              href="/destinations"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-strong"
            >
              <span aria-hidden="true">←</span>
              {t('backToList')}
            </Link>

            <p className="text-eyebrow mt-4 text-primary-strong">
              {destination.area[locale]}
            </p>
            <h1 className="mt-2 font-display text-[2.25rem] leading-[1.1] font-semibold tracking-tight md:text-5xl">
              {destination.name[locale]}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-foreground-muted">
              {destination.summary[locale]}
            </p>

            <ul className="mt-6 flex list-none flex-wrap gap-2 p-0">
              <li>
                <Badge tone="accent">{tRegion(destination.region)}</Badge>
              </li>
              {destination.tags[locale].map((tag) => (
                <li key={tag}>
                  <Badge>{tag}</Badge>
                </li>
              ))}
            </ul>

            <dl className="mt-8 grid gap-6 border-t border-border-subtle pt-6 sm:grid-cols-3">
              <div>
                <dt className="text-eyebrow text-foreground-muted">
                  {t('bestSeason')}
                </dt>
                <dd className="mt-2 text-base text-ink-800">
                  {destination.bestSeason[locale]}
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow text-foreground-muted">
                  {t('firstVisitedLabel')}
                </dt>
                <dd className="mt-2 text-base text-ink-800">
                  {formatDate(destination.firstVisited, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow text-foreground-muted">
                  {t('visitsLabel')}
                </dt>
                <dd className="mt-2">
                  <Link
                    href="/map"
                    className="inline-flex min-h-11 items-center font-medium text-primary-strong"
                  >
                    {t('visitCount', { count: destination.visits })}
                    <span className="ml-2" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </Container>
      </div>

      <Container width="narrow">
        <div className="py-12 md:py-16">
          <Prose paragraphs={destination.body[locale]} />
        </div>
      </Container>

      {relatedStories.length > 0 ? (
        <section
          aria-labelledby="related-stories-heading"
          className="border-t border-border-subtle bg-surface-muted py-12 md:py-16"
        >
          <Container width="wide">
            <h2
              id="related-stories-heading"
              className="mb-8 font-display text-2xl font-semibold md:text-3xl"
            >
              {t('relatedStories')}
            </h2>
            <ul className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {relatedStories.map((story) => (
                <li key={story.slug}>
                  <StoryCard story={story} locale={locale} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {destinationReviews.items.length > 0 ? (
        <section aria-labelledby="destination-reviews-heading" className="border-t border-border-subtle py-12 md:py-16">
          <Container width="wide">
            <h2 id="destination-reviews-heading" className="mb-8 font-display text-2xl font-semibold md:text-3xl">
              {tReviews('destinationTitle')}
            </h2>
            <ReviewList
              reviews={destinationReviews.items}
              summary={destinationReviews.summary}
              placeNames={Object.fromEntries(destinationPlaces.map((place) => [place.slug, place.name[locale]]))}
              locale={locale}
            />
          </Container>
        </section>
      ) : null}

      {relatedItineraries.length > 0 ? (
        <section
          aria-labelledby="related-itineraries-heading"
          className="py-12 md:py-16"
        >
          <Container width="wide">
            <h2
              id="related-itineraries-heading"
              className="mb-8 font-display text-2xl font-semibold md:text-3xl"
            >
              {t('relatedItineraries')}
            </h2>
            <ul className="grid list-none grid-cols-1 gap-5 p-0 xl:grid-cols-2">
              {relatedItineraries.map((itinerary) => (
                <li key={itinerary.slug}>
                  <ItineraryCard itinerary={itinerary} locale={locale} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </article>
  );
}
