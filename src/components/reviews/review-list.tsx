import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/format';
import { ReportButton } from '@/components/reports/report-button';
import type { PlaceReviewSummary, PublicCommunityReview } from '@/server/planner/schemas';

/**
 * Traveller reviews. Every string from a traveller is rendered as plain text by
 * React — no HTML, no clickable links — and is labelled self-reported, never
 * verified (ADR 0014). Each review has an opaque public id, used as the key and by the report control.
 */
export async function ReviewList({
  reviews,
  summary,
  placeNames,
  locale,
}: {
  reviews: PublicCommunityReview[];
  summary?: PlaceReviewSummary;
  /** Slug -> display name; omit on a page that is already about one place. */
  placeNames?: Record<string, string>;
  locale: Locale;
}) {
  const t = await getTranslations('communityReviews');

  return (
    <div className="grid gap-5">
      {summary && summary.count > 0 ? (
        <p className="text-base font-medium">
          {summary.average !== null
            ? t('average', { average: summary.average.toFixed(1), count: summary.count })
            : t('countOnly', { count: summary.count })}
        </p>
      ) : null}
      <ul className="grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-5"
          >
            {placeNames ? (
              <p className="text-eyebrow text-primary-strong">{placeNames[review.placeSlug] ?? review.placeSlug}</p>
            ) : null}
            <p className="font-medium" aria-label={t('ratingLabel', { rating: review.rating })}>
              <span aria-hidden="true">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            </p>
            <p lang={review.lang} className="whitespace-pre-line break-words text-base">
              {review.body}
            </p>
            <p className="mt-auto text-sm text-foreground-muted">
              {review.author ?? t('anonymous')} · {t('visited', { date: formatDate(review.visitedOn, locale) })}
            </p>
            <p className="text-xs text-foreground-muted">{t('selfReported')}</p>
            <ReportButton target={{ kind: 'review', id: review.id }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
