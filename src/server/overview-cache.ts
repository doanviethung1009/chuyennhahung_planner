/**
 * Short-lived cache of the admin dashboard payload (P07-11), kept in a
 * dependency-free module so the admin route guards can drop it after a
 * mutation without importing the dashboard itself. Held on `globalThis` so
 * the page and route bundles share one map.
 */
import { invalidateCatalogueCache } from './public-catalogue-cache';

export const OVERVIEW_CACHE_TTL_MS = 15_000;
const CACHE_KEY = Symbol.for('chuyennhahung.adminOverviewCache');
export type OverviewCacheEntry = { at: number; value: Promise<unknown> };
type GlobalWithCache = typeof globalThis & { [CACHE_KEY]?: Map<string, OverviewCacheEntry> };

export function overviewCache(): Map<string, OverviewCacheEntry> {
  const holder = globalThis as GlobalWithCache;
  return (holder[CACHE_KEY] ??= new Map());
}

/**
 * Drop only the dashboard payloads. Member and reader writes (a trip listing, a
 * report) change a dashboard count but not the public catalogue, so they must
 * not pay for clearing the catalogue cache as well.
 */
export function invalidateOverviewPayloads(): void {
  overviewCache().clear();
}

/** Forget every cached payload: call after a write that changes a count. */
export function invalidateOverviewCache(): void {
  invalidateOverviewPayloads();
  // The public place catalogue is cached for the same reason: a write must show at once.
  invalidateCatalogueCache();
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Drop the dashboard payloads after a state-changing member or reader request
 * (not staff: those use `invalidateOverviewCacheAfter`). Whatever its outcome.
 */
export function invalidateOverviewPayloadsAfter(request: Request): void {
  if (!SAFE.has(request.method.toUpperCase())) invalidateOverviewPayloads();
}

/** Drop the cache after a state-changing admin request, whatever its outcome. */
export function invalidateOverviewCacheAfter(request: Request): void {
  if (!SAFE.has(request.method.toUpperCase())) invalidateOverviewCache();
}
