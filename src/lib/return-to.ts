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
const RETURNABLE = (Object.keys(pathnames) as AppPathname[]).filter((key) => !NOT_RETURNABLE.includes(key));

function toPattern(path: string): RegExp {
  // The home page: `/` in Vietnamese, `/en` (or `/en/`) in English.
  if (path === '/') return /^(?:\/en)?\/?$/;
  const source = path
    .split('/')
    .map((part) => (/^\[\w+\]$/.test(part) ? '[A-Za-z0-9_-]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^(?:/en)?${source}/?$`);
}

const allowed: RegExp[] = RETURNABLE.flatMap((key) => {
  const entry: string | Record<string, string> = pathnames[key];
  return (typeof entry === 'string' ? [entry] : Object.values(entry)).map(toPattern);
});

/**
 * Validates a `returnTo` value (open-redirect guard). Accepts only a same-site
 * relative path that starts with a single `/`, has no backslash, control
 * character or scheme, and resolves to a known page of the site.
 * Anything else returns `fallback`.
 */
export function safeReturnTo(value: string | null | undefined, fallback = '/my-trips'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback;

  const path = value.split(/[?#]/, 1)[0] ?? '';
  if (path.includes(':')) return fallback;

  return allowed.some((pattern) => pattern.test(path)) ? value : fallback;
}
