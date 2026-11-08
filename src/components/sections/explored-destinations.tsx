import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { Destination } from '@/content/types';
import { Container } from '@/components/ui/container';
import { Section, SectionHeader } from '@/components/ui/section';
import { DestinationCard } from '@/components/cards/destination-card';

export async function ExploredDestinations({
  destinations,
  locale,
}: {
  destinations: Destination[];
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations('home.destinations'),
    getTranslations('common'),
  ]);

  return (
    <Section tone="muted" labelledBy="destinations-heading">
      <Container width="wide">
        <SectionHeader
          headingId="destinations-heading"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          action={{
            href: '/destinations',
            label: tCommon('viewAllDestinations'),
          }}
        />

        <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((destination) => (
            <li key={destination.slug}>
              <DestinationCard destination={destination} locale={locale} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
