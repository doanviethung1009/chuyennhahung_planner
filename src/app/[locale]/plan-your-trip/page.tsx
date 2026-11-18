import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { siteConfig, social } from '@/content/site';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import {
  ButtonExternalLink,
  ButtonLink,
  buttonClass,
} from '@/components/ui/button';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'plan' });

  return buildPageMetadata({
    href: '/plan-your-trip',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

/**
 * No form here: the page links into the Planner (stories with a real itinerary and a
 * blank trip) and keeps the contact routes — a prefilled mailto and the live social
 * profiles. A submit button with nothing behind it would be a dead control.
 */
export default async function PlanYourTripPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon] = await Promise.all([
    getTranslations('plan'),
    getTranslations('common'),
  ]);

  const steps = [1, 2, 3, 4] as const;

  const mailto = `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(
    t('emailSubject'),
  )}&body=${encodeURIComponent(t('emailBody'))}`;

  const socialChannels = social.filter((item) => item.platform !== 'email');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />

      <Container width="default">
        <div className="py-12 md:py-16">
          <p className="max-w-2xl text-lg leading-relaxed text-ink-800">
            {t('intro')}
          </p>

          <section
            aria-labelledby="start-heading"
            className="mt-10 rounded-2xl bg-surface-muted p-6 md:p-10"
          >
            <h2
              id="start-heading"
              className="font-display text-2xl font-semibold md:text-3xl"
            >
              {t('startTitle')}
            </h2>
            <p className="mt-2 text-base text-foreground-muted">
              {t('startLead')}
            </p>

            <div className="mt-7 grid gap-8 sm:grid-cols-2">
              <div>
                <ButtonLink href="/stories" size="lg">
                  {t('startTemplatesCta')}
                </ButtonLink>
                <p className="mt-3 text-base leading-relaxed text-foreground-muted">
                  {t('startTemplatesHint')}
                </p>
              </div>
              <div>
                <ButtonLink href="/my-trips/new" variant="secondary" size="lg">
                  {t('startBlankCta')}
                </ButtonLink>
                <p className="mt-3 text-base leading-relaxed text-foreground-muted">
                  {t('startBlankHint')}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="steps-heading" className="mt-14">
            <h2
              id="steps-heading"
              className="font-display text-2xl font-semibold md:text-3xl"
            >
              {t('stepsTitle')}
            </h2>

            <ol className="mt-8 grid list-none gap-6 p-0 sm:grid-cols-2">
              {steps.map((step) => (
                <li
                  key={step}
                  className="rounded-xl border border-border-subtle bg-surface p-6"
                >
                  <span className="flex size-10 items-center justify-center rounded-pill bg-clay-300/30 font-display text-base font-semibold text-clay-700">
                    {step}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">
                    {t(`step${step}Title`)}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-foreground-muted">
                    {t(`step${step}Detail`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="contact-heading"
            className="mt-14 rounded-2xl bg-surface-muted p-6 md:p-10"
          >
            <h2
              id="contact-heading"
              className="font-display text-2xl font-semibold md:text-3xl"
            >
              {t('contactTitle')}
            </h2>
            <p className="mt-2 text-base text-foreground-muted">
              {t('contactLead')}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href={mailto} className={buttonClass({ size: 'lg' })}>
                {t('emailCta')}
              </a>

              {socialChannels.map((channel) => (
                <ButtonExternalLink
                  key={channel.platform}
                  href={channel.url}
                  variant="secondary"
                  size="lg"
                  newTabLabel={tCommon('opensInNewTab')}
                >
                  {channel.label}
                </ButtonExternalLink>
              ))}
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}
