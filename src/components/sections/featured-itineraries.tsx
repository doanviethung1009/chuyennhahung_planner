import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { Itinerary } from '@/content/types';
import { Container } from '@/components/ui/container';
import { Section, SectionHeader } from '@/components/ui/section';
import { ItineraryCard } from '@/components/cards/itinerary-card';

export async function FeaturedItineraries({
  itineraries,
  locale,
}: {
  itineraries: Itinerary[];
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations('home.itineraries'),
    getTranslations('common'),
  ]);

  return (
    <Section tone="muted" labelledBy="itineraries-heading">
      <Container width="wide">
        <SectionHeader
          headingId="itineraries-heading"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          action={{
            href: '/itineraries',
            label: tCommon('viewAllItineraries'),
          }}
        />

        <ul className="grid list-none grid-cols-1 gap-5 p-0 xl:grid-cols-2">
          {itineraries.map((itinerary) => (
            <li key={itinerary.slug}>
              <ItineraryCard itinerary={itinerary} locale={locale} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
