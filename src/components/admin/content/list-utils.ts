/** Pure search and sort for the admin content lists (P07-15). No React, no I/O. */

export type SortKey = 'updated' | 'title' | 'slug';
export const SORT_KEYS: readonly SortKey[] = ['updated', 'title', 'slug'];

export interface ListItem {
  slug: string;
  updatedAt: string;
  title?: { vi: string; en: string };
  name?: { vi: string; en: string };
}

type Lang = 'vi' | 'en';

/** Lower-cased and stripped of diacritics, so "da lat" finds "Đà Lạt". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** The label shown for an item: the title or name in the locale, else the slug. */
export function itemTitle(item: ListItem, locale: Lang): string {
  return (item.title ?? item.name)?.[locale] ?? item.slug;
}

/** Substring match on the slug and both languages' titles. An empty query keeps everything. */
export function matchesQuery(item: ListItem, query: string): boolean {
  const needle = fold(query);
  if (needle === '') return true;
  const label = item.title ?? item.name;
  return [item.slug, label?.vi ?? '', label?.en ?? ''].some((part) => fold(part).includes(needle));
}

/** Returns a new array; the input is never mutated. `updated` is newest first. */
export function filterAndSort<T extends ListItem>(
  items: readonly T[],
  options: { query: string; sort: SortKey; locale: Lang },
): T[] {
  const { query, sort, locale } = options;
  const kept = items.filter((item) => matchesQuery(item, query));
  const byUpdated = (a: T, b: T) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  const compare =
    sort === 'title'
      ? (a: T, b: T) => itemTitle(a, locale).localeCompare(itemTitle(b, locale), locale) || a.slug.localeCompare(b.slug)
      : sort === 'slug'
        ? (a: T, b: T) => a.slug.localeCompare(b.slug)
        : (a: T, b: T) => byUpdated(a, b) || a.slug.localeCompare(b.slug);
  return kept.sort(compare);
}
