import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { VideoReview } from '@/content/types';
import { Container } from '@/components/ui/container';
import { Section, SectionHeader } from '@/components/ui/section';
import { VideoCard } from '@/components/cards/video-card';

/** Portrait cards: 2-up on phones, widening to 4-up on large screens. */
export async function VideoReviewsSection({
  videos,
  locale,
}: {
  videos: VideoReview[];
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations('home.reviews'),
    getTranslations('common'),
  ]);

  return (
    <Section labelledBy="reviews-heading">
      <Container width="wide">
        <SectionHeader
          headingId="reviews-heading"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          action={{ href: '/reviews', label: tCommon('viewAllReviews') }}
        />

        <ul className="grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {videos.map((video) => (
            <li key={video.id}>
              <VideoCard video={video} locale={locale} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
