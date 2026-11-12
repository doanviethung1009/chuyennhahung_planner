import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { Section, SectionHeader } from '@/components/ui/section';
import { StoryCard, type StoryCardData } from '@/components/cards/story-card';

/** First story is given the wide treatment; the rest fill a 2-up grid. */
export async function LatestStories({
  stories,
  locale,
}: {
  stories: StoryCardData[];
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations('home.stories'),
    getTranslations('common'),
  ]);

  const [lead, ...rest] = stories;
  if (!lead) return null;

  return (
    <Section labelledBy="latest-stories-heading">
      <Container width="wide">
        <SectionHeader
          headingId="latest-stories-heading"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          action={{ href: '/stories', label: tCommon('viewAllStories') }}
        />

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <StoryCard story={lead} locale={locale} featured />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            {rest.slice(0, 2).map((story) => (
              <StoryCard key={story.slug} story={story} locale={locale} />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
