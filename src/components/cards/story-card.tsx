import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { Story } from '@/content/types';
import { formatMonthYear } from '@/lib/format';
import { CoverImage } from '@/components/ui/cover-image';
import { MetaRow } from '@/components/ui/badge';

/**
 * The whole card is one link. The cover is decorative (`alt=""`) because the
 * title immediately after it carries the same meaning — announcing both would
 * make a screen reader read the story twice.
 */
export async function StoryCard({
  story,
  locale,
  featured = false,
  priority = false,
}: {
  story: Story;
  locale: Locale;
  featured?: boolean;
  priority?: boolean;
}) {
  const t = await getTranslations('common');

  return (
    <article className="group h-full">
      <Link
        href={{ pathname: '/stories/[slug]', params: { slug: story.slug } }}
        className="flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-soft transition-shadow duration-300 ease-gentle hover:shadow-lift"
      >
        <div
          className={`relative w-full overflow-hidden ${
            featured ? 'aspect-16/10' : 'aspect-3/2'
          }`}
        >
          <CoverImage
            src={story.cover}
            alt=""
            priority={priority}
            sizes={
              featured
                ? '(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 720px'
                : '(max-width: 768px) 85vw, (max-width: 1280px) 45vw, 380px'
            }
            className="transition-transform duration-500 ease-gentle group-hover:scale-[1.03]"
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
          <MetaRow
            items={[
              formatMonthYear(story.publishedAt, locale),
              t('minuteRead', { minutes: story.readingMinutes }),
            ]}
          />

          <h3
            className={`font-semibold leading-snug text-balance ${
              featured ? 'text-2xl md:text-3xl' : 'text-xl md:text-[1.375rem]'
            }`}
          >
            {story.title[locale]}
          </h3>

          <p className="line-clamp-3 text-base text-foreground-muted">
            {story.excerpt[locale]}
          </p>

          <span className="mt-auto inline-flex items-center gap-2 pt-2 font-medium text-primary-strong">
            {t('readStory')}
            <span
              aria-hidden="true"
              className="transition-transform duration-200 ease-gentle group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </div>
      </Link>
    </article>
  );
}
