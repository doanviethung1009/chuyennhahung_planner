import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { getPublicContent, type PublicStory } from '@/server/content/public';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { StoryCard } from '@/components/cards/story-card';
import { ButtonLink } from '@/components/ui/button';
import { StateNotice } from '@/components/ui/state-notice';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'stories' });

  return buildPageMetadata({
    href: '/stories',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

export default async function StoriesPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tStates] = await Promise.all([getTranslations('stories'), getTranslations('states')]);
  // Not swallowed into "empty": a failed read shows an error with a way to retry.
  // No user data in the log, only the error class.
  let storiesNewestFirst: PublicStory[] | null = null;
  try {
    storiesNewestFirst = await (await getPublicContent()).listStories();
  } catch (error) {
    console.error('stories: could not read the stories', error instanceof Error ? error.name : 'error');
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={
          storiesNewestFirst ? (
            <p className="text-sm text-foreground-muted">
              {t('count', { count: storiesNewestFirst.length })}
            </p>
          ) : null
        }
      />

      <Container width="wide">
        <div className="py-12 md:py-16">
          {storiesNewestFirst === null ? (
            <StateNotice tone="error" title={t('errorTitle')} body={t('errorBody')}>
              <ButtonLink href="/stories" variant="secondary">
                {tStates('retry')}
              </ButtonLink>
            </StateNotice>
          ) : storiesNewestFirst.length === 0 ? (
            <p className="text-foreground-muted">{t('empty')}</p>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {storiesNewestFirst.map((story, i) => (
                <li key={story.slug}>
                  <StoryCard story={story} locale={locale} priority={i < 3} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}
