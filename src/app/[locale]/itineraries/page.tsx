import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { itineraries } from '@/content/itineraries';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { ItineraryCard } from '@/components/cards/itinerary-card';
import { ButtonLink } from '@/components/ui/button';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'itineraries' });

  return buildPageMetadata({
    href: '/itineraries',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

export default async function ItinerariesPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tPlan] = await Promise.all([
    getTranslations('itineraries'),
    getTranslations('plan'),
  ]);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={
          <p className="text-sm text-foreground-muted">
            {t('count', { count: itineraries.length })}
          </p>
        }
      >
        <ButtonLink href="/plan-your-trip" size="lg">
          {tPlan('title')}
        </ButtonLink>
      </PageHeader>

      <Container width="wide">
        <div className="py-12 md:py-16">
          <ul className="grid list-none grid-cols-1 gap-5 p-0 xl:grid-cols-2">
            {itineraries.map((itinerary, i) => (
              <li key={itinerary.slug}>
                <ItineraryCard
                  itinerary={itinerary}
                  locale={locale}
                  priority={i < 2}
                />
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-sm text-foreground-muted">
            {t('priceNote')}
          </p>
        </div>
      </Container>
    </>
  );
}
