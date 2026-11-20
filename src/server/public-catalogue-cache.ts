/**
 * Short-lived cache of the public place catalogue (places-list-load), kept in a
 * dependency-free module so `overview-cache.ts` can drop it after a write
 * without importing the content repository. Held on `globalThis` so the page,
 * route and sitemap bundles share one entry.
 *
 * The entry is a promise, so concurrent requests share one store read. Callers
 * decide what a rejection means; a rejected entry is removed, never served.
 */
export const CATALOGUE_TTL_MS = 10_000;
const CACHE_KEY = Symbol.for('chuyennhahung.publicCatalogueCache');
type Entry = { at: number; value: Promise<unknown> };
type GlobalWithCache = typeof globalThis & { [CACHE_KEY]?: Entry | null };

export function readCatalogueCache<T>(load: () => Promise<T>, now: number = Date.now()): Promise<T> {
  const holder = globalThis as GlobalWithCache;
  const hit = holder[CACHE_KEY];
  if (hit && now - hit.at >= 0 && now - hit.at < CATALOGUE_TTL_MS) return hit.value as Promise<T>;

  const value = load();
  const entry: Entry = { at: now, value };
  holder[CACHE_KEY] = entry;
  value.catch(() => {
    if (holder[CACHE_KEY] === entry) holder[CACHE_KEY] = null;
  });
  return value;
}

/** Forget the cached catalogue: call after any write. */
export function invalidateCatalogueCache(): void {
  (globalThis as GlobalWithCache)[CACHE_KEY] = null;
}
