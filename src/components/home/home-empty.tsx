import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';

/**
 * The home page of an environment with no published story yet (UXS-1). It used to
 * render nothing, leaving a header and a footer around an empty `<main>`. It holds
 * the page's single `<h1>` and two real ways forward.
 */
export async function HomeEmpty() {
  const t = await getTranslations('home.empty');
  return (
    <>
      <PageHeader title={t('title')} description={t('body')} />
      <Container width="wide">
        <div className="flex flex-wrap gap-3 py-12 md:py-16">
          <ButtonLink href="/trip-templates" size="lg">
            {t('templates')}
          </ButtonLink>
          <ButtonLink href="/my-trips/new" variant="secondary" size="lg">
            {t('newTrip')}
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
