import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { siteConfig } from '@/content/site';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { Prose } from '@/components/ui/prose';
import { ButtonLink } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { JsonLd } from '@/components/seo/json-ld';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  return buildPageMetadata({
    href: '/about',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

export default async function AboutPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('about');
  const values = [1, 2, 3] as const;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
          slogan: siteConfig.tagline[locale],
          description: t('description'),
          email: siteConfig.contactEmail,
          foundingDate: '2021',
        }}
      />

      <PageHeader
        eyebrow={t('heading')}
        title={t('title')}
        description={t('lead')}
      />

      <Container width="wide">
        <div className="grid gap-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <Prose
              paragraphs={[t('body1'), t('body2'), t('body3')]}
            />
          </div>

          <div className="lg:col-span-5">
            <div className="relative aspect-4/5 w-full overflow-hidden rounded-2xl shadow-soft">
              <CoverImage
                src="/images/covers/ha-giang.svg"
                alt=""
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
        </div>
      </Container>

      <section
        aria-labelledby="values-heading"
        className="border-t border-border-subtle bg-surface-muted py-12 md:py-16"
      >
        <Container width="wide">
          <h2
            id="values-heading"
            className="font-display text-2xl font-semibold md:text-3xl"
          >
            {t('valuesTitle')}
          </h2>
          <ul className="mt-8 grid list-none gap-6 p-0 md:grid-cols-3">
            {values.map((value) => (
              <li
                key={value}
                className="rounded-xl border border-border-subtle bg-surface p-6"
              >
                <h3 className="font-display text-lg font-semibold">
                  {t(`value${value}Title`)}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-foreground-muted">
                  {t(`value${value}Detail`)}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="about-cta-heading" className="py-12 md:py-16">
        <Container width="default">
          <div className="text-center">
            <h2
              id="about-cta-heading"
              className="font-display text-2xl font-semibold md:text-3xl"
            >
              {t('ctaTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-foreground-muted md:text-lg">
              {t('ctaLead')}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/stories" size="lg">
                {t('ctaStories')}
              </ButtonLink>
              <ButtonLink href="/plan-your-trip" variant="secondary" size="lg">
                {t('ctaPlan')}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
