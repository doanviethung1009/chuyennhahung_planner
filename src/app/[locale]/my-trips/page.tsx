import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { MyTrips } from '@/components/planner/my-trips';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'myTrips' });
  return {
    ...buildPageMetadata({
      href: '/my-trips',
      locale,
      title: t('title'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function MyTripsPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('myTrips');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="default">
        <div className="py-10 md:py-14">
          <p className="mb-6">
            <Link
              href="/my-map"
              className="inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4"
            >
              {t('mapLink')}
            </Link>
          </p>
          <MyTrips />
        </div>
      </Container>
    </>
  );
}
