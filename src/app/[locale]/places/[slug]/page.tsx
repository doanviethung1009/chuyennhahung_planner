import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { formatPlaceCost, placeDurationParts } from '@/lib/place-format';
import { siteConfig } from '@/content/site';
import { getDestination } from '@/content/destinations';
import { getPublicPlace } from '@/server/content/public-places';
import { getApprovedReviews } from '@/server/community/public';
import { ReviewList } from '@/components/reviews/review-list';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { Badge } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover-image';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const place = await getPublicPlace(slug);
  if (!place) return {};

  return buildPageMetadata({
    href: { pathname: '/places/[slug]', params: { slug } },
    locale,
    title: place.name[locale],
    description: place.description[locale][0] ?? place.location[locale],
    image: place.images[0],
  });
}

export default async function PlacePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const place = await getPublicPlace(slug);
  if (!place) notFound();

  const t = await getTranslations('places');
  const destination = getDestination(place.destinationSlug);
  const reviews = await getApprovedReviews([place.slug], 12);
  const duration = placeDurationParts(place.suggestedMinutes);
  const name = place.name[locale];
  const cover = place.images[0];
  const gallery = place.images.slice(1);

  return (
    <article>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TouristAttraction',
          name,
          description: place.description[locale].join(' '),
          inLanguage: locale,
          ...(cover ? { image: new URL(cover, siteConfig.url).toString() } : {}),
          address: { '@type': 'PostalAddress', streetAddress: place.location[locale], addressCountry: 'VN' },
        }}
      />

      <Container width="wide">
        <div className="py-8 md:py-12">
          {destination ? (
            <Link
              href={{ pathname: '/destinations/[slug]', params: { slug: destination.slug } }}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-strong"
            >
              <span aria-hidden="true">←</span>
              {t('backToDestination', { destination: destination.name[locale] })}
            </Link>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`categories.${place.category}`)}</Badge>
            {destination ? <Badge>{destination.name[locale]}</Badge> : null}
          </div>
          <h1 className="mt-3 font-display text-[2.25rem] leading-[1.1] font-semibold tracking-tight md:text-5xl">
            {name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-foreground-muted">{place.location[locale]}</p>

          {cover ? (
            <div className="relative mt-8 aspect-16/10 w-full overflow-hidden rounded-2xl md:aspect-21/9">
              <CoverImage src={cover} alt={t('imageAlt', { name, index: 1 })} priority sizes="(max-width: 1280px) 100vw, 1280px" />
            </div>
          ) : null}

          <dl className="mt-8 grid gap-6 border-t border-border-subtle pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-eyebrow text-foreground-muted">{t('categoryLabel')}</dt>
              <dd className="mt-2 text-base text-ink-800">{t(`categories.${place.category}`)}</dd>
            </div>
            <div>
              <dt className="text-eyebrow text-foreground-muted">{t('durationLabel')}</dt>
              <dd className="mt-2 text-base text-ink-800">{t(duration.key, duration.values)}</dd>
            </div>
            <div>
              <dt className="text-eyebrow text-foreground-muted">{t('costLabel')}</dt>
              <dd className="mt-2 text-base text-ink-800">{formatPlaceCost(place.estimatedCostVnd, locale)}</dd>
            </div>
            {place.rating !== null ? (
              <div>
                <dt className="text-eyebrow text-foreground-muted">{t('ratingLabel')}</dt>
                <dd className="mt-2 text-base text-ink-800">
                  <span aria-hidden="true">{t('ratingValue', { rating: place.rating })}</span>
                  <span className="sr-only">{t('ratingValueLabel', { rating: place.rating })}</span>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </Container>

      <Container width="narrow">
        <section aria-labelledby="place-about-heading" className="pb-12 md:pb-16">
          <h2 id="place-about-heading" className="mb-4 font-display text-2xl font-semibold md:text-3xl">
            {t('aboutTitle')}
          </h2>
          <Prose paragraphs={place.description[locale]} />
          {place.personalNote ? (
            <aside aria-labelledby="place-note-heading" className="mt-8 rounded-xl border border-border-subtle bg-surface-muted p-5">
              <h3 id="place-note-heading" className="text-eyebrow text-primary-strong">
                {t('noteTitle')}
              </h3>
              <p className="mt-2 text-base">{place.personalNote[locale]}</p>
            </aside>
          ) : null}
        </section>
      </Container>

      {gallery.length > 0 ? (
        <section aria-labelledby="place-gallery-heading" className="border-t border-border-subtle py-12 md:py-16">
          <Container width="wide">
            <h2 id="place-gallery-heading" className="mb-8 font-display text-2xl font-semibold md:text-3xl">
              {t('galleryTitle')}
            </h2>
            <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((src, index) => (
                <li key={src} className="relative aspect-3/2 overflow-hidden rounded-xl">
                  <CoverImage src={src} alt={t('imageAlt', { name, index: index + 2 })} sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px" />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      <section aria-labelledby="place-reviews-heading" className="border-t border-border-subtle py-12 md:py-16">
        <Container width="wide">
          <h2 id="place-reviews-heading" className="mb-8 font-display text-2xl font-semibold md:text-3xl">
            {t('reviewsTitle')}
          </h2>
          {reviews.items.length > 0 ? (
            <ReviewList reviews={reviews.items} summary={reviews.summary} locale={locale} />
          ) : (
            <p className="text-foreground-muted">{t('reviewsEmpty')}</p>
          )}
        </Container>
      </section>
    </article>
  );
}
