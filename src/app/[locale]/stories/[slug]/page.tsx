import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { siteConfig } from '@/content/site';
import { getStory, stories } from '@/content/stories';
import { getDestination } from '@/content/destinations';
import { formatDate } from '@/lib/format';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { Badge, MetaRow } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover-image';
import { JsonLd } from '@/components/seo/json-ld';

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const story = getStory(slug);
  if (!story) return {};

  return buildPageMetadata({
    href: { pathname: '/stories/[slug]', params: { slug } },
    locale,
    title: story.title[locale],
    description: story.excerpt[locale],
    image: story.cover,
    type: 'article',
    publishedTime: story.publishedAt,
  });
}

export default async function StoryPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const story = getStory(slug);
  if (!story) notFound();

  const t = await getTranslations('common');
  const places = story.destinationSlugs
    .map(getDestination)
    .filter((d) => d !== undefined);

  return (
    <article>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: story.title[locale],
          description: story.excerpt[locale],
          datePublished: story.publishedAt,
          inLanguage: locale,
          image: new URL(story.cover, siteConfig.url).toString(),
          author: { '@type': 'Organization', name: siteConfig.name },
          publisher: { '@type': 'Organization', name: siteConfig.name },
        }}
      />

      <Container width="default">
        <div className="py-10 md:py-14">
          <Link
            href="/stories"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-strong"
          >
            <span aria-hidden="true">←</span>
            {t('backToList')}
          </Link>

          <h1 className="mt-6 font-display text-[2.125rem] leading-[1.12] font-semibold tracking-tight md:text-5xl">
            {story.title[locale]}
          </h1>

          <MetaRow
            className="mt-5"
            items={[
              formatDate(story.publishedAt, locale),
              t('minuteRead', { minutes: story.readingMinutes }),
            ]}
          />

          {places.length > 0 ? (
            <ul className="mt-5 flex list-none flex-wrap gap-2 p-0">
              {places.map((place) => (
                <li key={place.slug}>
                  <Link
                    href={{
                      pathname: '/destinations/[slug]',
                      params: { slug: place.slug },
                    }}
                    className="inline-flex min-h-11 items-center"
                  >
                    <Badge tone="primary">{place.name[locale]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>

      <Container width="wide">
        <div className="relative aspect-16/10 w-full overflow-hidden rounded-2xl shadow-soft md:aspect-21/9">
          <CoverImage
            src={story.cover}
            alt=""
            priority
            sizes="(max-width: 1280px) 100vw, 1200px"
          />
        </div>
      </Container>

      <Container width="narrow">
        <div className="py-12 md:py-16">
          <p className="mb-8 border-l-2 border-primary pl-5 font-display text-xl leading-relaxed text-ink-800 italic md:text-2xl">
            {story.excerpt[locale]}
          </p>
          <Prose paragraphs={story.body[locale]} />
        </div>
      </Container>
    </article>
  );
}
