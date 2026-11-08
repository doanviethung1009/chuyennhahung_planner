import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { ButtonLink } from '@/components/ui/button';

/**
 * Links to the real planning page. The self-serve planner is a later phase, so
 * there is deliberately no form here — a button that cannot submit would be a
 * dead control.
 */
export async function PlanTripCta() {
  const t = await getTranslations('home.plan');

  return (
    <section aria-labelledby="plan-cta-heading" className="py-14 md:py-20">
      <Container width="wide">
        <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-12 text-center md:px-12 md:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-pill bg-clay-500/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-pill bg-jade-500/25 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl">
            <p className="text-eyebrow text-clay-300">{t('eyebrow')}</p>
            <h2
              id="plan-cta-heading"
              className="mt-4 font-display text-3xl leading-tight font-semibold text-cream-50 md:text-4xl"
            >
              {t('title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-cream-100/80 md:text-lg">
              {t('lead')}
            </p>
            <div className="mt-8 flex justify-center">
              <ButtonLink href="/plan-your-trip" size="lg">
                {t('cta')}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
