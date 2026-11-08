import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { storiesNewestFirst } from '@/content/stories';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { StoryCard } from '@/components/cards/story-card';

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

  const t = await getTranslations('stories');

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={
          <p className="text-sm text-foreground-muted">
            {t('count', { count: storiesNewestFirst.length })}
          </p>
        }
      />

      <Container width="wide">
        <div className="py-12 md:py-16">
          {storiesNewestFirst.length === 0 ? (
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
