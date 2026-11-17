import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { PublicPlace } from '@/server/content/public-places';
import { formatPlaceCost, placeDurationParts } from '@/lib/place-format';
import { CoverImage } from '@/components/ui/cover-image';
import { Badge, MetaRow } from '@/components/ui/badge';

/** The whole card is one link; the photo is decorative because the name right after it says the same. */
export async function PlaceCard({ place, locale }: { place: PublicPlace; locale: Locale }) {
  const t = await getTranslations('places');
  const duration = placeDurationParts(place.suggestedMinutes);
  const cover = place.images[0];

  return (
    <article className="group h-full">
      <Link
        href={{ pathname: '/places/[slug]', params: { slug: place.slug } }}
        className="flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-soft transition-shadow duration-300 ease-gentle hover:shadow-lift"
      >
        {cover ? (
          <div className="relative aspect-3/2 w-full overflow-hidden">
            <CoverImage
              src={cover}
              alt=""
              sizes="(max-width: 768px) 85vw, (max-width: 1280px) 45vw, 380px"
              className="transition-transform duration-500 ease-gentle group-hover:scale-[1.03]"
            />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
          <div>
            <Badge tone="accent">{t(`categories.${place.category}`)}</Badge>
          </div>
          <h3 className="text-xl leading-snug font-semibold text-balance">{place.name[locale]}</h3>
          <MetaRow
            items={[
              place.location[locale],
              t(duration.key, duration.values),
              formatPlaceCost(place.estimatedCostVnd, locale),
            ]}
          />
          <span className="mt-auto inline-flex min-h-11 items-center gap-2 pt-2 font-medium text-primary-strong">
            {t('viewPlace')}
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
