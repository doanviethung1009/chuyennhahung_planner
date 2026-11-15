import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { contributionOpen } from '@/content/site';
import { getApprovedReviews, getReviewPlaces } from '@/server/community/public';
import { Container } from '@/components/ui/container';
import { Section, SectionHeader } from '@/components/ui/section';
import { ReviewList } from '@/components/reviews/review-list';
import { ReviewForm } from '@/components/reviews/review-form';

/**
 * Latest traveller reviews, plus the form for anyone to add one (ADR 0014).
 * Hidden when there is nothing to show and the form is still closed.
 */
export async function CommunityReviewsSection({ locale }: { locale: Locale }) {
  const [{ items }, places] = await Promise.all([getApprovedReviews(undefined, 3), getReviewPlaces()]);
  const canWrite = contributionOpen && places.length > 0;
  if (items.length === 0 && !canWrite) return null;

  const t = await getTranslations('communityReviews');
  const placeNames = Object.fromEntries(places.map((place) => [place.slug, place.name[locale]]));

  return (
    <Section labelledBy="community-reviews-heading">
      <Container width="wide">
        <SectionHeader
          headingId="community-reviews-heading"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
        />
        {items.length > 0 ? <ReviewList reviews={items} placeNames={placeNames} locale={locale} /> : null}

        {canWrite ? (
          <details className="mt-8 rounded-2xl bg-surface-muted p-5 md:p-8">
            <summary className="flex min-h-11 cursor-pointer items-center font-display text-xl font-semibold">
              {t('writeTitle')}
            </summary>
            <div className="mt-5">
              <ReviewForm
                mode="guest"
                places={places.map((place) => ({ slug: place.slug, name: place.name[locale] }))}
              />
            </div>
          </details>
        ) : null}
      </Container>
    </Section>
  );
}
