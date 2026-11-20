import { getTranslations } from 'next-intl/server';
import { destinations } from '@/content/destinations';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { VietnamMap, type MapPin } from '@/components/map/vietnam-map';
import type { MemberMapState } from '@/server/planner/member-map';

/**
 * The member's own map (ADR 0029). Receives only the allow-listed state; the
 * name, coordinates, `featured` and label side of each point come from the
 * content seed, read-only. A guest and a member with nothing yet both get the
 * bare outline — never somebody else's pins.
 */
export async function MemberMapView({
  state,
  locale,
}: {
  state: MemberMapState;
  locale: Locale;
}) {
  const t = await getTranslations('memberMap');

  const bySlug = new Map(destinations.map((destination) => [destination.slug, destination]));
  const pins: MapPin[] =
    state.status === 'ready'
      ? state.points.flatMap((point) => {
          const destination = bySlug.get(point.slug);
          if (!destination) return [];
          const { slug, name, coords, featured, labelSide } = destination;
          return [{ slug, name, coords, featured, labelSide, visits: point.visits }];
        })
      : [];

  const signIn = `${getPathname({ href: '/sign-in', locale })}?returnTo=${encodeURIComponent(
    getPathname({ href: '/my-trips', locale }),
  )}`;

  return (
    <div className="grid gap-12 py-12 md:py-16 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-5">
        <div className="rounded-2xl bg-surface-muted p-6 md:p-8">
          <VietnamMap destinations={pins} locale={locale} mapLabel={t('mapLabel')} />
        </div>
        <div className="mt-5 rounded-xl border border-border-subtle p-4">
          <h2 className="text-eyebrow text-foreground-muted">{t('legend')}</h2>
          <p className="mt-2 flex items-center gap-3 text-sm text-foreground-muted">
            <span
              aria-hidden="true"
              className="inline-block size-3 shrink-0 rounded-pill border-2 border-cream-50 bg-primary shadow-soft"
            />
            {t('legendVisited')}
          </p>
          <p className="mt-2 flex items-center gap-3 text-sm text-foreground-muted">
            <span
              aria-hidden="true"
              className="inline-block size-3 shrink-0 rounded-pill border-2 border-primary bg-cream-50"
            />
            {t('legendPlanned')}
          </p>
        </div>
      </div>

      <div className="lg:col-span-7">
        {state.status === 'ready' ? (
          <>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">{t('listTitle')}</h2>
            <ul className="mt-6 flex list-none flex-col gap-1 p-0">
              {pins.map((pin) => (
                <li key={pin.slug}>
                  <Link
                    href={{ pathname: '/destinations/[slug]', params: { slug: pin.slug } }}
                    className="flex min-h-14 items-center justify-between gap-4 rounded-xl border-b border-border-subtle px-3 py-3 transition-colors duration-200 ease-gentle hover:bg-surface-muted"
                  >
                    <span className="font-display text-lg font-semibold text-ink-900">
                      {pin.name[locale]}
                    </span>
                    <span className="shrink-0 text-sm text-foreground-muted">
                      {(pin.visits ?? 0) > 0 ? t('visited') : t('planned')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-foreground-muted">
              {t('privateNote')}
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-border-subtle p-6 md:p-8">
            <p className="text-lg leading-relaxed text-ink-800">
              {state.status === 'guest' ? t('guestPrompt') : t('emptyPrompt')}
            </p>
            {state.status === 'guest' ? (
              <a href={signIn} className={buttonClass({ className: 'mt-6' })}>
                {t('guestCta')}
              </a>
            ) : (
              <Link href="/my-trips/new" className={buttonClass({ className: 'mt-6' })}>
                {t('emptyCta')}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
