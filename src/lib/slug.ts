/**
 * Slug helpers for the admin create forms (P07-22). Pure and client-safe.
 *
 * The rules mirror `slugSchema` in `src/server/content/schemas.ts` (lowercase
 * words joined by single hyphens, 3–96 characters). The server stays the source
 * of truth; `tests/slug.test.ts` checks both agree.
 */

import { foldText } from './fold';

export const SLUG_MIN = 3;
export const SLUG_MAX = 96;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True when the server's `slugSchema` would accept this exact string. */
export function isValidSlug(value: string): boolean {
  return value.length >= SLUG_MIN && value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}

/**
 * Turns a Vietnamese (or English) title into a slug. `đ`/`Đ` are mapped by hand:
 * NFD leaves them whole. Returns `''` when fewer than 3 characters survive —
 * no slug is invented.
 */
export function slugify(text: string): string {
  const joined = foldText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let slug = joined;
  if (slug.length > SLUG_MAX) {
    const cut = slug.slice(0, SLUG_MAX);
    // Cut at a word boundary when the next character would continue a word.
    slug = slug[SLUG_MAX] === '-' ? cut : cut.slice(0, Math.max(cut.lastIndexOf('-'), 0)) || cut;
    slug = slug.replace(/-+$/g, '');
  }
  return slug.length >= SLUG_MIN ? slug : '';
}
