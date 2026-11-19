import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { isVisited, type Destination } from '@/content/types';
import {
  MAP_HEIGHT,
  MAP_TARGET_PX,
  MAP_WIDTH,
  labelSide,
  VIETNAM_OUTLINE_PATH,
  pinRadius,
  project,
} from '@/lib/map';

/**
 * The outline is a decorative SVG; the pins are real HTML anchors positioned
 * over it as percentages of the projected coordinate space. That keeps the map
 * keyboard-navigable and crawlable, and it works with no client JavaScript —
 * hover and focus states are pure CSS.
 */
export function VietnamMap({
  destinations,
  locale,
  mapLabel,
  variant = 'full',
}: {
  destinations: Destination[];
  locale: Locale;
  mapLabel: string;
  variant?: 'full' | 'preview';
}) {
  const showLabels = variant === 'full';

  return (
    <div
      className="relative mx-auto w-full"
      style={{ maxWidth: variant === 'full' ? 420 : 340 }}
    >
      <div
        className="relative"
        style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}
      >
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          <defs>
            <linearGradient id="vn-land" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="var(--color-sand-200)" />
              <stop offset="100%" stopColor="var(--color-sand-300)" />
            </linearGradient>
          </defs>
          <path
            d={VIETNAM_OUTLINE_PATH}
            fill="url(#vn-land)"
            stroke="var(--color-sand-400)"
            strokeWidth="1.5"
          />
        </svg>

        <ul aria-label={mapLabel} className="absolute inset-0 m-0 list-none p-0">
          {destinations.map((destination) => {
            const { x, y } = project(
              destination.coords.lat,
              destination.coords.lng,
            );
            const r = pinRadius(destination.visits);
            // Pins in the right half put the label on their left so it never leaves the frame.
            const flipLabel = labelSide(x) === 'left';

            return (
              <li
                key={destination.slug}
                className="absolute"
                style={{
                  left: `${(x / MAP_WIDTH) * 100}%`,
                  top: `${(y / MAP_HEIGHT) * 100}%`,
                }}
              >
                <Link
                  href={{
                    pathname: '/destinations/[slug]',
                    params: { slug: destination.slug },
                  }}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{ width: MAP_TARGET_PX, height: MAP_TARGET_PX }}
                >
                  {/* The anchor box itself is the 44px target; the dot is centred on the projected point. */}
                  <span
                    aria-hidden="true"
                    className={`relative block rounded-pill border-2 shadow-soft transition-transform duration-200 ease-gentle group-hover:scale-125 group-focus-visible:scale-125 ${
                      isVisited(destination)
                        ? 'border-cream-50 bg-primary'
                        : 'border-primary bg-cream-50'
                    }`}
                    style={{ width: r * 2, height: r * 2 }}
                  />
                  <span
                    className={
                      showLabels
                        ? `absolute top-1/2 -translate-y-1/2 whitespace-nowrap ${flipLabel ? 'right-full' : 'left-full'} rounded-pill bg-cream-50/90 px-2 py-0.5 text-xs font-semibold text-ink-800 shadow-soft`
                        : 'sr-only'
                    }
                  >
                    {destination.name[locale]}
                  </span>
                  {showLabels ? null : (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-ink-900 px-2.5 py-1 text-xs font-medium text-cream-50 opacity-0 transition-opacity duration-200 ease-gentle group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      {destination.name[locale]}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
