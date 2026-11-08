import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import { storiesNewestFirst } from '@/content/stories';
import { itineraries } from '@/content/itineraries';
import { videoReviewsNewestFirst } from '@/content/video-reviews';
import { Hero } from '@/components/sections/hero';
import { LatestStories } from '@/components/sections/latest-stories';
import { ExploredDestinations } from '@/components/sections/explored-destinations';
import { MapPreview } from '@/components/sections/map-preview';
import { FeaturedItineraries } from '@/components/sections/featured-itineraries';
import { PlanTripCta } from '@/components/sections/plan-trip-cta';
import { VideoReviewsSection } from '@/components/sections/video-reviews-section';
import { AboutSection } from '@/components/sections/about-section';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return buildPageMetadata({
    href: '/',
    locale,
    title: t('homeTitle'),
    description: t('homeDescription'),
  });
}

export default async function HomePage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const featured = storiesNewestFirst[0];
  if (!featured) return null;

  const featuredItineraries = itineraries.filter((i) => i.featured);

  return (
    <>
      <Hero locale={locale} featured={featured} />

      <LatestStories stories={storiesNewestFirst.slice(0, 3)} locale={locale} />

      <ExploredDestinations
        destinations={destinations.slice(0, 4)}
        locale={locale}
      />

      <MapPreview destinations={destinations} locale={locale} />

      <FeaturedItineraries itineraries={featuredItineraries} locale={locale} />

      <PlanTripCta />

      <VideoReviewsSection
        videos={videoReviewsNewestFirst.slice(0, 4)}
        locale={locale}
      />

      <AboutSection />
    </>
  );
}
