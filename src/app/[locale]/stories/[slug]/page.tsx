import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { siteConfig } from '@/content/site';
import { getDestination } from '@/content/destinations';
import { formatDate } from '@/lib/format';
import { cache } from 'react';
import { getRepository } from '@/server/content/instance';
import { getPublicContent } from '@/server/content/public';
import type { TravelTemplate } from '@/server/content/schemas';
import { Container } from '@/components/ui/container';
import { ButtonLink } from '@/components/ui/button';
import { ItineraryDays } from '@/components/planner/itinerary-days';
import { StoryBlocks, PlaceCard } from '@/components/story/story-blocks';
import { Badge, MetaRow } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover-image';
import { JsonLd } from '@/components/seo/json-ld';

/** Content is read per request (ADR 0012): no static params, no revalidate window. */
export const dynamic = 'force-dynamic';

/** One read per request, shared by `generateMetadata` and the page. */
const getStory = cache(async (slug: string) => (await getPublicContent()).getStory(slug));

/**
 * A missing or withdrawn template means no section and no CTA, never a dead
 * link. `getPublicContent` already nulled the slug for a non-public template;
 * this loads the days for the ones that remain.
 */
async function loadLinkedTemplate(slug: string | null): Promise<TravelTemplate | null> {
  if (!slug) return null;
  try {
    return await (await getRepository()).getPublicTemplate(slug);
  } catch {
    return null;
  }
}

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const story = await getStory(slug);
  if (!story) return {};

  const metadata = buildPageMetadata({
    href: { pathname: '/stories/[slug]', params: { slug } },
    locale,
    title: story.seo.title[locale],
    description: story.seo.description[locale],
    image: story.seo.ogImage,
    type: 'article',
    publishedTime: story.publishedAtIso,
  });
  return story.seo.noindex ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}

export default async function StoryPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const story = await getStory(slug);
  if (!story) notFound();

  const [t, tJourney, tStory] = await Promise.all([
    getTranslations('common'),
    getTranslations('journey'),
    getTranslations('storyPage'),
  ]);
  const template = await loadLinkedTemplate(story.plannerTemplateSlug);
  const destinationBadges = story.destinationSlugs
    .map(getDestination)
    .filter((d) => d !== undefined);

  // Places the body does not embed inline get their own section.
  const embedded = new Set(
    story.blocks.flatMap((block) => (block.type === 'place' ? [block.placeSlug] : [])),
  );
  const unlistedPlaces = story.places.filter((place) => !embedded.has(place.slug));

  return (
    <article>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: story.title[locale],
          description: story.excerpt[locale],
          datePublished: story.publishedAtIso,
          dateModified: story.updatedAt,
          inLanguage: locale,
          image: new URL(story.seo.ogImage, siteConfig.url).toString(),
          author: { '@type': 'Organization', name: siteConfig.name },
          publisher: { '@type': 'Organization', name: siteConfig.name },
        }}
      />

      <Container width="default">
        <div className="py-10 md:py-14">
          <Link
            href="/stories"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-strong"
          >
            <span aria-hidden="true">←</span>
            {t('backToList')}
          </Link>

          <h1 className="mt-6 font-display text-[2.125rem] leading-[1.12] font-semibold tracking-tight md:text-5xl">
            {story.title[locale]}
          </h1>

          <MetaRow
            className="mt-5"
            items={[
              formatDate(story.publishedAt, locale),
              t('minuteRead', { minutes: story.readingMinutes }),
            ]}
          />

          {destinationBadges.length > 0 ? (
            <ul className="mt-5 flex list-none flex-wrap gap-2 p-0">
              {destinationBadges.map((place) => (
                <li key={place.slug}>
                  <Link
                    href={{
                      pathname: '/destinations/[slug]',
                      params: { slug: place.slug },
                    }}
                    className="inline-flex min-h-11 items-center"
                  >
                    <Badge tone="primary">{place.name[locale]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>

      <Container width="wide">
        <div className="relative aspect-16/10 w-full overflow-hidden rounded-2xl shadow-soft md:aspect-21/9">
          <CoverImage
            src={story.cover}
            alt=""
            priority
            sizes="(max-width: 1280px) 100vw, 1200px"
          />
        </div>
      </Container>

      <Container width="narrow">
        <div className="py-12 md:py-16">
          <p className="mb-8 border-l-2 border-primary pl-5 font-display text-xl leading-relaxed text-ink-800 italic md:text-2xl">
            {story.excerpt[locale]}
          </p>
          <StoryBlocks blocks={story.blocks} places={story.places} locale={locale} />
        </div>
      </Container>

      {unlistedPlaces.length > 0 ? (
        <Container width="narrow">
          <section aria-labelledby="story-places" className="border-t border-border-subtle pb-12 pt-10">
            <h2 id="story-places" className="font-display text-2xl font-semibold md:text-3xl">
              {tStory('placesTitle')}
            </h2>
            <ul className="mt-6 grid list-none gap-4 p-0">
              {unlistedPlaces.map((place) => (
                <li key={place.slug}>
                  <PlaceCard place={place} note={null} locale={locale} t={tStory} />
                </li>
              ))}
            </ul>
          </section>
        </Container>
      ) : null}

      {story.reviews.length > 0 ? (
        <Container width="narrow">
          <section aria-labelledby="story-reviews" className="border-t border-border-subtle pb-12 pt-10">
            <h2 id="story-reviews" className="font-display text-2xl font-semibold md:text-3xl">
              {tStory('reviewsTitle')}
            </h2>
            <ul className="mt-6 grid list-none gap-6 p-0">
              {story.reviews.map((review) => (
                <li key={review.id}>
                  <article className="rounded-xl border border-border-subtle bg-surface p-5 shadow-soft md:p-6">
                    <h3 className="font-display text-xl font-semibold text-ink-900">{review.title[locale]}</h3>
                    <MetaRow
                      className="mt-2"
                      items={[
                        tStory('reviewRating', { rating: review.rating }),
                        tStory('reviewVisited', { date: formatDate(review.visitedOn, locale) }),
                      ]}
                    />
                    <div className="mt-4 flex flex-col gap-3 text-base text-ink-800">
                      {review.body[locale].map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>
                    {review.pros[locale].length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-ink-900">{tStory('reviewPros')}</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-base text-ink-800">
                          {review.pros[locale].map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {review.cons[locale].length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-ink-900">{tStory('reviewCons')}</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-base text-ink-800">
                          {review.cons[locale].map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          </section>
        </Container>
      ) : null}

      {template ? (
        <Container width="narrow">
          <section aria-labelledby="real-itinerary" className="border-t border-border-subtle pb-16 pt-12 md:pb-20">
            <h2 id="real-itinerary" className="font-display text-2xl font-semibold md:text-3xl">
              {tJourney('title')}
            </h2>
            <p className="mt-2 text-base text-foreground-muted">{tJourney('lead')}</p>
            <div className="mt-8">
              <ItineraryDays
                locale={locale}
                days={template.days.map((day) => ({
                  dayNumber: day.day,
                  title: day.title[locale],
                  date: null,
                  summary: day.summary?.[locale] ?? null,
                  activities: day.activities.map((a) => ({
                    title: a.title[locale],
                    startTime: a.startTime ?? null,
                    note: a.note?.[locale] ?? null,
                  })),
                }))}
              />
            </div>
            <div className="mt-10 rounded-2xl bg-surface-muted p-6 md:p-8">
              <p className="text-base text-foreground-muted">{tJourney('ctaLead')}</p>
              <ButtonLink
                href={{ pathname: '/trip-setup/[template]', params: { template: template.slug } }}
                size="lg"
                className="mt-4"
              >
                {tJourney('cta')}
              </ButtonLink>
            </div>
          </section>
        </Container>
      ) : null}
    </article>
  );
}
