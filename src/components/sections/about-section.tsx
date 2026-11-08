import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { ButtonLink } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';

export async function AboutSection() {
  const t = await getTranslations('home.about');

  return (
    <Section tone="muted" labelledBy="about-heading">
      <Container width="wide">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-soft">
            <CoverImage
              src="/images/covers/story-da-lat.svg"
              alt=""
              sizes="(max-width: 1024px) 100vw, 45vw"
            />
          </div>

          <div>
            <p className="text-eyebrow text-primary-strong">{t('eyebrow')}</p>
            <h2
              id="about-heading"
              className="mt-3 font-display text-3xl leading-tight font-semibold md:text-4xl"
            >
              {t('title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground-muted md:text-lg">
              {t('lead')}
            </p>
            <div className="mt-7">
              <ButtonLink href="/about" variant="secondary" size="lg">
                {t('cta')}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
