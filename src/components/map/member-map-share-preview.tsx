import { getTranslations } from 'next-intl/server';
import { getDestination } from '@/content/destinations';
import type { Locale } from '@/i18n/routing';
import { VietnamMap } from '@/components/map/vietnam-map';
import { sharedMapDestinations } from '@/server/planner/shared-map-page';
import type { PublicMemberMapPoint } from '@/server/planner/member-map-share';

/**
 * What a visitor would see (ADR 0030 §2): the public projection only — visited
 * places in three sizes, no planned points, no reviews, no dates — and the name
 * they would see. Name mode is closed, so the shared name is always anonymous.
 * The map and its pin rules are `VietnamMap`'s, unchanged.
 */
export async function MemberMapSharePreview({
  points,
  locale,
}: {
  points: readonly PublicMemberMapPoint[];
  locale: Locale;
}) {
  const t = await getTranslations('memberMapShare');
  const tShared = await getTranslations('sharedMap');
  const pins = sharedMapDestinations(points);
  const buckets = new Map(points.map((point) => [point.slug, point.visitsBucket]));

  return (
    <div data-testid="share-preview">
      <h3 className="font-display text-xl font-semibold">{t('previewTitle')}</h3>
      <p className="mt-2 text-base text-foreground-muted">{t('previewIntro')}</p>
      <p className="mt-2 text-sm font-medium text-foreground">
        {t('previewNameLabel')}{' '}
        <span className="font-normal text-foreground-muted">{t('previewNameAnonymous')}</span>
      </p>
      {pins.length < 2 ? (
        <p className="mt-3 rounded-md border border-border-strong bg-surface p-4 text-sm text-foreground">
          {t('sparseWarning')}
        </p>
      ) : null}
      <div className="mt-4 rounded-2xl bg-surface p-4 md:p-6">
        <VietnamMap destinations={pins} locale={locale} mapLabel={t('previewMapLabel')} />
      </div>
      {pins.length === 0 ? (
        <p className="mt-3 text-sm text-foreground-muted">{t('previewEmpty')}</p>
      ) : (
        <ul className="mt-4 flex list-none flex-col p-0">
          {pins.map((pin) => (
            <li
              key={pin.slug}
              className="flex min-h-11 items-center justify-between gap-4 border-b border-border-subtle px-1 py-2"
            >
              <span className="font-display text-base font-semibold text-ink-900">
                {getDestination(pin.slug)?.name[locale] ?? pin.slug}
              </span>
              <span className="shrink-0 text-sm text-foreground-muted">
                {tShared(`bucket${buckets.get(pin.slug) ?? 1}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-foreground-muted">{t('previewNote')}</p>
    </div>
  );
}
