import { pathnames } from '@/i18n/routing';

/**
 * The only places a sign-in may send a traveller back to. Everything is derived
 * from the route table, so a renamed route cannot leave a stale allow-list.
 * `/shared/[token]` and `/sign-in` itself are deliberately absent: neither is
 * somewhere you "return" to after signing in.
 */
const RETURNABLE = ['/my-trips', '/my-trips/[id]', '/trip-setup/[template]', '/account/password', '/admin'] as const;

function toPattern(path: string): RegExp {
  const source = path
    .split('/')
    .map((part) => (/^\[\w+\]$/.test(part) ? '[A-Za-z0-9_-]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^(?:/en)?${source}/?$`);
}

const allowed: RegExp[] = RETURNABLE.flatMap((key) => {
  const entry = pathnames[key];
  return Object.values(entry).map(toPattern);
});

/**
 * Validates a `returnTo` value (open-redirect guard). Accepts only a same-site
 * relative path that starts with a single `/`, has no backslash, control
 * character or scheme, and resolves to a known localized private route.
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
