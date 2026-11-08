import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { Destination } from '@/content/types';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { ButtonLink } from '@/components/ui/button';
import { VietnamMap } from '@/components/map/vietnam-map';

export async function MapPreview({
  destinations,
  locale,
}: {
  destinations: Destination[];
  locale: Locale;
}) {
  const [t, tMap] = await Promise.all([
    getTranslations('home.map'),
    getTranslations('map'),
  ]);

  return (
    <Section labelledBy="map-preview-heading">
      <Container width="wide">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-eyebrow text-primary-strong">{t('eyebrow')}</p>
            <h2
              id="map-preview-heading"
              className="mt-3 text-3xl leading-tight font-semibold md:text-4xl"
            >
              {t('title')}
            </h2>
            <p className="mt-4 max-w-md text-base text-foreground-muted md:text-lg">
              {t('lead')}
            </p>
            <p className="mt-3 text-sm text-foreground-muted">
              {tMap('legendVisits')}
            </p>
            <div className="mt-7">
              <ButtonLink href="/map" variant="secondary" size="lg">
                {t('cta')}
              </ButtonLink>
            </div>
          </div>

          <div className="order-first lg:order-none">
            <VietnamMap
              destinations={destinations}
              locale={locale}
              mapLabel={tMap('mapLabel')}
              variant="preview"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
