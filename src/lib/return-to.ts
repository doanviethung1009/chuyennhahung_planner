import { pathnames, type AppPathname } from '@/i18n/routing';

/**
 * The only places a sign-in may send a traveller back to. Everything is derived
 * from the route table, so a renamed route cannot leave a stale allow-list.
 * Every page of the site is returnable — the header's sign-in link sends the
 * visitor back to whatever they were reading — except `/shared/[token]` (a
 * share link carries a capability in its path; it should not travel through a
 * sign-in URL) and `/sign-in` itself, which is nowhere to "return" to.
 */
const NOT_RETURNABLE: readonly AppPathname[] = ['/sign-in', '/shared/[token]'];

/**
 * Private pages keep their query (a trip-setup draft, for one). On a public
 * page the query and fragment are dropped: they are not needed to land back on
 * the page, and a `returnTo` is copied into sign-in URLs, logs, `Referer` and
 * the stored Google attempt.
 */
const KEEPS_QUERY: readonly AppPathname[] = [
  '/my-trips',
  '/my-trips/[id]',
  '/trip-setup/[template]',
  '/new-trip',
  '/account/password',
  '/admin',
  '/admin/content/stories',
  '/admin/content/stories/[slug]',
  '/admin/content/places',
  '/admin/content/places/[slug]',
  '/admin/content/reviews',
];
const PUBLIC = (Object.keys(pathnames) as AppPathname[]).filter(
  (key) => !NOT_RETURNABLE.includes(key) && !KEEPS_QUERY.includes(key),
);

function toPattern(path: string): RegExp {
  // The home page: `/` in Vietnamese, `/en` (or `/en/`) in English.
  if (path === '/') return /^(?:\/en)?\/?$/;
  const source = path
    .split('/')
    .map((part) => (/^\[\w+\]$/.test(part) ? '[A-Za-z0-9_-]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^(?:/en)?${source}/?$`);
}

function patternsFor(keys: readonly AppPathname[]): RegExp[] {
  return keys.flatMap((key) => {
    const entry: string | Record<string, string> = pathnames[key];
    return (typeof entry === 'string' ? [entry] : Object.values(entry)).map(toPattern);
  });
}

const privatePatterns = patternsFor(KEEPS_QUERY);
const publicPatterns = patternsFor(PUBLIC);

/**
 * Validates a `returnTo` value (open-redirect guard). Accepts only a same-site
 * relative path that starts with a single `/`, has no backslash, control
 * character or scheme, and resolves to a known page of the site. A private
 * page is returned as given; a public page as its path alone. Anything else
 * returns `fallback`.
 */
export function safeReturnTo(value: string | null | undefined, fallback = '/my-trips'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback;

  const path = value.split(/[?#]/, 1)[0] ?? '';
  if (path.includes(':')) return fallback;

  if (privatePatterns.some((pattern) => pattern.test(path))) return value;
  if (publicPatterns.some((pattern) => pattern.test(path))) return path;
  return fallback;
}
