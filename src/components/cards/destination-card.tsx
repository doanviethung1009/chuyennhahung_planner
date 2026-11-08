import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { Destination } from '@/content/types';
import { CoverImage } from '@/components/ui/cover-image';
import { Badge } from '@/components/ui/badge';

export async function DestinationCard({
  destination,
  locale,
  priority = false,
}: {
  destination: Destination;
  locale: Locale;
  priority?: boolean;
}) {
  const t = await getTranslations('common');

  return (
    <article className="group h-full">
      <Link
        href={{
          pathname: '/destinations/[slug]',
          params: { slug: destination.slug },
        }}
        className="relative flex h-full min-h-72 flex-col justify-end overflow-hidden rounded-xl shadow-soft transition-shadow duration-300 ease-gentle hover:shadow-lift"
      >
        <div className="absolute inset-0">
          <CoverImage
            src={destination.cover}
            alt=""
            priority={priority}
            sizes="(max-width: 768px) 85vw, (max-width: 1280px) 45vw, 360px"
            className="transition-transform duration-500 ease-gentle group-hover:scale-[1.04]"
          />
          {/* Scrim: the caption sits on artwork, so contrast must not depend on it. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/35 to-transparent"
          />
        </div>

        <div className="relative flex flex-col gap-2 p-5 md:p-6">
          <p className="text-eyebrow text-sand-300">{destination.area[locale]}</p>
          <h3 className="text-2xl font-semibold text-cream-50">
            {destination.name[locale]}
          </h3>
          <p className="line-clamp-2 text-sm text-cream-100/85">
            {destination.summary[locale]}
          </p>
          {destination.visits > 1 ? (
            <Badge
              tone="neutral"
              className="mt-1 w-fit border-cream-50/25 bg-cream-50/15 text-cream-50"
            >
              {t('visitCount', { count: destination.visits })}
            </Badge>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
