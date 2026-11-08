import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { ButtonLink } from '@/components/ui/button';

export default async function LocaleNotFound() {
  const t = await getTranslations('notFound');

  return (
    <Container width="narrow">
      <div className="py-24 text-center md:py-32">
        <p className="text-eyebrow text-primary-strong">404</p>
        <h1 className="mt-4 font-display text-4xl font-semibold md:text-5xl">
          {t('title')}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-foreground-muted">
          {t('description')}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" size="lg">
            {t('cta')}
          </ButtonLink>
          <ButtonLink href="/stories" variant="secondary" size="lg">
            {t('ctaStories')}
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
