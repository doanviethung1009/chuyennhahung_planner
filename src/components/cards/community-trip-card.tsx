import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getDestination } from '@/content/destinations';
import type { CommunityTripCard as Card } from '@/server/planner/schemas';
import { CoverImage } from '@/components/ui/cover-image';
import { Badge } from '@/components/ui/badge';

/**
 * A community trip. The title and author are traveller-written text: they are
 * rendered as plain text by React, never as HTML. The link carries the share
 * token — acceptable only because a listed trip is `public` (ADR 0014).
 */
export async function CommunityTripCard({ trip, locale }: { trip: Card; locale: Locale }) {
  const [t, tStyle] = await Promise.all([getTranslations('community'), getTranslations('travelStyle')]);
  const destination = getDestination(trip.destinationSlug);

  return (
    <article className="group h-full">
      <Link
        href={{ pathname: '/shared/[token]', params: { token: trip.shareToken } }}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-soft transition-shadow duration-300 ease-gentle hover:shadow-lift"
      >
        <div className="relative h-40 overflow-hidden bg-surface-muted">
          {destination ? (
            <CoverImage
              src={destination.cover}
              alt=""
              sizes="(max-width: 768px) 85vw, (max-width: 1280px) 45vw, 360px"
              className="transition-transform duration-500 ease-gentle group-hover:scale-[1.04]"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <p className="text-eyebrow text-primary-strong">{destination?.name[locale] ?? trip.destinationSlug}</p>
          <h3 className="font-display text-xl font-semibold">{trip.title}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge>{t('days', { count: trip.durationDays })}</Badge>
            <Badge>{t('party', { count: trip.partySize })}</Badge>
            <Badge>{t('activities', { count: trip.activityCount })}</Badge>
            {trip.travelStyle ? <Badge tone="accent">{tStyle(trip.travelStyle)}</Badge> : null}
          </div>
          <p className="mt-auto text-sm text-foreground-muted">
            {trip.author ? t('by', { author: trip.author }) : t('byAnonymous')}
          </p>
        </div>
      </Link>
    </article>
  );
}
