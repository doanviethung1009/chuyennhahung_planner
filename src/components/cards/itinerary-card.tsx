import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { Itinerary } from '@/content/types';
import { formatVnd } from '@/lib/format';
import { CoverImage } from '@/components/ui/cover-image';
import { Badge, MetaRow } from '@/components/ui/badge';

export async function ItineraryCard({
  itinerary,
  locale,
  priority = false,
}: {
  itinerary: Itinerary;
  locale: Locale;
  priority?: boolean;
}) {
  const [t, tPace] = await Promise.all([
    getTranslations('common'),
    getTranslations('pace'),
  ]);

  return (
    <article className="group h-full">
      <Link
        href={{
          pathname: '/itineraries/[slug]',
          params: { slug: itinerary.slug },
        }}
        className="flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-soft transition-shadow duration-300 ease-gentle hover:shadow-lift sm:flex-row"
      >
        <div className="relative aspect-3/2 w-full shrink-0 overflow-hidden sm:aspect-auto sm:w-2/5">
          <CoverImage
            src={itinerary.cover}
            alt=""
            priority={priority}
            sizes="(max-width: 640px) 90vw, (max-width: 1280px) 40vw, 320px"
            className="transition-transform duration-500 ease-gentle group-hover:scale-[1.03]"
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
          <MetaRow
            items={[
              t('dayCount', { days: itinerary.days }),
              t('nightCount', { nights: itinerary.nights }),
            ]}
          />

          <h3 className="text-xl font-semibold leading-snug md:text-[1.375rem]">
            {itinerary.title[locale]}
          </h3>

          <p className="line-clamp-3 text-base text-foreground-muted">
            {itinerary.summary[locale]}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            <Badge tone="accent">{tPace(itinerary.pace)}</Badge>
            <p className="text-sm text-foreground-muted">
              {t('from')}{' '}
              <span className="font-semibold text-foreground">
                {formatVnd(itinerary.priceFromVnd, locale)}
              </span>
              {t('perPerson')}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
