import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { formatVnd } from '@/lib/format';
import { getRepository } from '@/server/content/instance';
import type { TravelTemplate } from '@/server/content/schemas';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { TripSetupForm } from '@/components/planner/trip-setup-form';

type Params = { params: Promise<{ locale: Locale; template: string }> };

export const dynamic = 'force-dynamic';

async function loadTemplate(slug: string): Promise<TravelTemplate | null> {
  try {
    return await (await getRepository()).getPublicTemplate(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, template } = await params;
  const t = await getTranslations({ locale, namespace: 'tripSetup' });
  return {
    ...buildPageMetadata({
      href: { pathname: '/trip-setup/[template]', params: { template } },
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function TripSetupPage({ params }: Params) {
  const { locale, template: slug } = await params;
  setRequestLocale(locale);

  const template = await loadTemplate(slug);
  if (!template) notFound();

  const t = await getTranslations('tripSetup');

  return (
    <>
      <PageHeader
        title={t('pageTitle')}
        description={t('description')}
        meta={
          <p className="text-base text-foreground-muted">
            {t('basedOn')} <strong className="font-semibold text-foreground">{template.title[locale]}</strong>
            {' · '}
            {t('templateMeta', {
              days: template.durationDays,
              total: formatVnd(template.estimatedTotalVnd, locale),
            })}
          </p>
        }
      />
      <Container width="narrow">
        <div className="py-10 md:py-14">
          <TripSetupForm
            templateSlug={template.slug}
            defaults={{ title: template.title.vi, estimatedTotalVnd: template.estimatedTotalVnd }}
          />
        </div>
      </Container>
    </>
  );
}
