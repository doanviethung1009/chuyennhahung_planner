import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { VideoReview } from '@/content/types';
import { getDestination } from '@/content/destinations';
import { formatDuration } from '@/lib/format';
import { CoverImage } from '@/components/ui/cover-image';

const platformLabel: Record<VideoReview['platform'], string> = {
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

/**
 * Presentational only — deliberately not a link.
 *
 * We do not hold per-video URLs, so there is nothing truthful to link to.
 * Rather than send every card to the channel and imply it opens that specific
 * clip, the card carries no interaction at all: no anchor, no play button, no
 * hover lift. Visitors reach the clips through the channel buttons on the
 * reviews page.
 */
export async function VideoCard({
  video,
  locale,
  priority = false,
}: {
  video: VideoReview;
  locale: Locale;
  priority?: boolean;
}) {
  const t = await getTranslations('common');
  const destination = getDestination(video.destinationSlug);
  const platform = platformLabel[video.platform];
  const duration = formatDuration(video.durationSeconds);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-soft">
      <div className="relative aspect-9/13 w-full overflow-hidden">
        <CoverImage
          src={video.cover}
          alt=""
          priority={priority}
          sizes="(max-width: 640px) 45vw, (max-width: 1280px) 30vw, 260px"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/25 to-transparent"
        />

        <span className="absolute top-3 left-3 rounded-pill bg-cream-50/95 px-2.5 py-1 text-xs font-semibold text-ink-900">
          {platform}
        </span>

        {/* Static marker: tells you it is a video and how long, without
            pretending to be a play control. */}
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-pill bg-ink-900/75 px-2.5 py-1 text-xs font-medium text-cream-50">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-3"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="sr-only">{t('videoLength')} </span>
          {duration}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 md:p-5">
        {destination ? (
          <p className="text-eyebrow text-primary-strong">
            {destination.name[locale]}
          </p>
        ) : null}
        <h3 className="text-base leading-snug font-semibold md:text-lg">
          {video.title[locale]}
        </h3>
      </div>
    </article>
  );
}
