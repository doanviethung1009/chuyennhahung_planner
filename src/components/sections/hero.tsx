import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { Story } from '@/content/types';
import { destinations } from '@/content/destinations';
import { stories } from '@/content/stories';
import { Container } from '@/components/ui/container';
import { ButtonLink } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';

const FOUNDED_YEAR = 2021;

export async function Hero({
  locale,
  featured,
}: {
  locale: Locale;
  featured: Story;
}) {
  const t = await getTranslations('home.hero');
  const years = new Date().getFullYear() - FOUNDED_YEAR;

  const stats = [
    { value: destinations.length, label: t('statDestinations') },
    { value: stories.length, label: t('statStories') },
    { value: years, label: t('statYears') },
  ];

  return (
    <section className="relative overflow-hidden pt-10 pb-14 md:pt-16 md:pb-20 lg:pt-20 lg:pb-28">
      {/* Warm wash behind the headline. Decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-24 size-[34rem] rounded-pill bg-clay-300/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-32 size-[26rem] rounded-pill bg-jade-500/10 blur-3xl"
      />

      <Container width="wide" className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6 xl:col-span-5">
            <p className="text-eyebrow text-primary-strong">{t('eyebrow')}</p>

            <h1 className="mt-4 font-display text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground-muted md:text-xl">
              {t('lead')}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink
                href={{
                  pathname: '/stories/[slug]',
                  params: { slug: featured.slug },
                }}
                size="lg"
              >
                {t('ctaPrimary')}
              </ButtonLink>
              <ButtonLink href="/map" variant="secondary" size="lg">
                {t('ctaSecondary')}
              </ButtonLink>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border-subtle pt-6">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-display text-3xl font-semibold text-primary-strong md:text-4xl">
                      {stat.value}
                    </span>
                    <span className="mt-1 block text-sm text-foreground-muted">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured cover, offset like a magazine plate. */}
          <div className="lg:col-span-6 xl:col-span-7">
            <figure className="relative">
              <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-lift sm:aspect-16/10">
                <CoverImage
                  src={featured.cover}
                  alt=""
                  priority
                  sizes="(max-width: 1024px) 100vw, 55vw"
                />
              </div>
              <figcaption className="mx-4 -mt-10 relative rounded-xl bg-surface p-5 shadow-soft sm:mx-8 md:p-6">
                <p className="text-eyebrow text-primary-strong">
                  {t('eyebrow')}
                </p>
                <p className="mt-2 font-display text-lg leading-snug font-semibold text-ink-900 md:text-xl">
                  {featured.title[locale]}
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </Container>
    </section>
  );
}
