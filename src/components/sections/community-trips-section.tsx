import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { CommunityTripCard as Card } from '@/server/planner/schemas';
import { Container } from '@/components/ui/container';
import { Section, SectionHeader } from '@/components/ui/section';
import { CommunityTripCard } from '@/components/cards/community-trip-card';

/** Hidden when there is nothing approved — no empty shell, no filler (ADR 0014). */
export async function CommunityTripsSection({ trips, locale }: { trips: Card[]; locale: Locale }) {
  if (trips.length === 0) return null;
  const t = await getTranslations('home.community');

  return (
    <Section labelledBy="community-trips-heading" tone="muted">
      <Container width="wide">
        <SectionHeader
          headingId="community-trips-heading"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          action={{ href: '/community-trips', label: t('viewAll') }}
        />
        <ul className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.shareToken}>
              <CommunityTripCard trip={trip} locale={locale} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
