/**
 * Display names a visitor may not use for a guest review (batch 10.6a, P10-16):
 * they would read as the site or its staff. The single list — add to it here.
 * Entries are written plain (lowercase, no diacritics); matching normalises the
 * candidate the same way, so case and Vietnamese diacritics do not matter.
 * Note that "Hưng" alone is an ordinary given name and is deliberately NOT listed.
 */
export const RESERVED_NAME_PHRASES: readonly string[] = [
  'admin',
  'administrator',
  'quan tri',
  'quan tri vien',
  'moderator',
  'mod',
  'staff',
  'nhan vien',
  'ban bien tap',
  'bien tap',
  'editor',
  'support',
  'ho tro',
  'official',
  'chinh thuc',
  'chuyen nha hung',
];

/** Lowercase, strip diacritics (đ → d), keep letters/digits as space-separated tokens. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NORMALISED = RESERVED_NAME_PHRASES.map(normalizeName);
const SQUASHED_MIN = 8;

/** True when the name contains a reserved phrase as whole words, or a long one run together. */
export function impersonatesStaff(name: string): boolean {
  const normal = normalizeName(name);
  const padded = ` ${normal} `;
  const squashed = normal.replace(/ /g, '');
  return NORMALISED.some(
    (phrase) =>
      padded.includes(` ${phrase} `) ||
      (phrase.replace(/ /g, '').length >= SQUASHED_MIN && squashed.includes(phrase.replace(/ /g, ''))),
  );
}
