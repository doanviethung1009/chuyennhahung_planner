import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { provincesWithDestinations } from '@/content/provinces';
import type { Province } from '@/content/types';

const chipClass = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium transition-colors duration-200 ease-gentle ${
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border-strong bg-surface text-ink-700 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
  }`;

/**
 * One chip per offered province (default: those holding a destination), as plain links to `?province=`
 * so the filter works without JavaScript and every state is a shareable URL.
 * `active` is '' for "all" (see `parseDestinationProvince`).
 */
export function ProvinceFilterNav({
  basePath,
  active,
  locale,
  label,
  allLabel,
  provinces = provincesWithDestinations,
  className,
}: {
  basePath: '/destinations' | '/map' | '/itineraries';
  active: string;
  locale: Locale;
  label: string;
  allLabel: string;
  /** Provinces to offer; defaults to those holding a destination. */
  provinces?: Province[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex list-none flex-wrap gap-2 p-0">
        <li>
          <Link href={basePath} aria-current={active ? undefined : 'page'} className={chipClass(!active)}>
            {allLabel}
          </Link>
        </li>
        {provinces.map((p) => (
          <li key={p.slug}>
            <Link
              href={{ pathname: basePath, query: { province: p.slug } }}
              aria-current={active === p.slug ? 'page' : undefined}
              className={chipClass(active === p.slug)}
            >
              {p.name[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
