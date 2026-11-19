/**
 * Case- and diacritic-insensitive text folding, shared by the slug helper
 * (P07-22) and the places search (PLACES-UI-S6). Pure and client-safe.
 *
 * `đ`/`Đ` are mapped by hand: NFD leaves them whole.
 */
export function foldText(text: string): string {
  return text
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * True when `foldedNeedle` (already passed through `foldText`) is a substring of
 * any haystack. A plain `includes` — the needle is data and never becomes a
 * pattern, so no regex or wildcard syntax is interpreted.
 */
export function foldedIncludes(haystacks: readonly string[], foldedNeedle: string): boolean {
  return haystacks.some((haystack) => foldText(haystack).includes(foldedNeedle));
}
