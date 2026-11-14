import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { destinations } from '@/content/destinations';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { BlankTripForm } from '@/components/planner/blank-trip-form';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'newTrip' });
  return {
    ...buildPageMetadata({
      href: '/new-trip',
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function NewTripPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newTrip');

  return (
    <>
      <PageHeader title={t('pageTitle')} description={t('description')} />
      <Container width="narrow">
        <div className="py-10 md:py-14">
          <BlankTripForm destinations={destinations.map((d) => ({ slug: d.slug, name: d.name[locale] }))} />
        </div>
      </Container>
    </>
  );
}
