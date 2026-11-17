import { OVERVIEW_CACHE_TTL_MS, invalidateOverviewCache, overviewCache as sharedCache } from '@/server/overview-cache';
import { can, type Action, type Principal } from '@/server/identity/permissions';

/**
 * Admin dashboard composition (P07-11). Read-only: it only calls existing
 * repository methods and returns counts — never a row, a handle or an email.
 * Each card is gated by the same `can()` actions as the screen it links to,
 * and a failing source degrades that one card to `unavailable`.
 */
export const OVERVIEW_CARD_IDS = [
  'listingsPending',
  'reviewsPending',
  'contentDrafts',
  'usersActive',
  'usersDisabled',
  'runtime',
] as const;
export type OverviewCardId = (typeof OVERVIEW_CARD_IDS)[number];

export type OverviewHref =
  | '/admin/community'
  | '/admin/content/stories'
  | '/admin/users'
  | '/admin/runbook';

/** `listReviewQueue` returns at most this many rows, so a count at the cap is a minimum. */
export const REVIEW_QUEUE_CAP = 200;

export interface OverviewCard {
  id: OverviewCardId;
  href: OverviewHref;
  /** Absent when the source failed (`state: 'unavailable'`) or the card is not a count. */
  count?: number;
  state: 'ok' | 'unavailable';
  /** The count is a lower bound ("200+"): the source list was capped. */
  atLeast?: boolean;
  severity?: 'attention';
  /** Runtime card only: where the two stores live. */
  detail?: 'postgres' | 'file' | 'mixed';
}

export interface Overview {
  cards: OverviewCard[];
}

/** The sources the dashboard reads; injectable so tests can fail one. */
export interface OverviewSources {
  pendingListings(): Promise<number>;
  pendingReviews(): Promise<number>;
  contentDrafts(): Promise<number>;
  users(): Promise<{ active: number; disabled: number }>;
  runtime(): 'postgres' | 'file' | 'mixed';
}

type Definition = {
  id: OverviewCardId;
  action: Action;
  href: OverviewHref;
};

// Order is the display order. Actions mirror the screen each card opens.
const DEFINITIONS: readonly Definition[] = [
  { id: 'listingsPending', action: 'community:moderate', href: '/admin/community' },
  { id: 'reviewsPending', action: 'community:moderate', href: '/admin/community' },
  { id: 'contentDrafts', action: 'content:write', href: '/admin/content/stories' },
  { id: 'usersActive', action: 'user:provision', href: '/admin/users' },
  { id: 'usersDisabled', action: 'user:provision', href: '/admin/users' },
  { id: 'runtime', action: 'runbook:read', href: '/admin/runbook' },
];

async function count(read: () => Promise<number>): Promise<{ count?: number; state: 'ok' | 'unavailable' }> {
  try {
    return { count: await read(), state: 'ok' };
  } catch {
    return { state: 'unavailable' };
  }
}

export async function buildOverview(principal: Principal, sources: OverviewSources): Promise<Overview> {
  const allowed = DEFINITIONS.filter((definition) => can(principal, definition.action));

  // The two user counts share one read.
  const needsUsers = allowed.some((d) => d.id === 'usersActive' || d.id === 'usersDisabled');
  const users = needsUsers
    ? await sources.users().then(
        (value) => value,
        () => null,
      )
    : null;

  const cards = await Promise.all(
    allowed.map(async (definition): Promise<OverviewCard> => {
      const base = { id: definition.id, href: definition.href };
      switch (definition.id) {
        case 'listingsPending':
        case 'reviewsPending':
        case 'contentDrafts': {
          const read =
            definition.id === 'listingsPending'
              ? sources.pendingListings
              : definition.id === 'reviewsPending'
                ? sources.pendingReviews
                : sources.contentDrafts;
          const result = await count(read);
          return {
            ...base,
            ...result,
            ...(definition.id === 'reviewsPending' && (result.count ?? 0) >= REVIEW_QUEUE_CAP
              ? { atLeast: true }
              : {}),
            ...(result.count !== undefined && result.count > 0 && definition.id !== 'contentDrafts'
              ? { severity: 'attention' as const }
              : {}),
          };
        }
        case 'usersActive':
          return users ? { ...base, count: users.active, state: 'ok' } : { ...base, state: 'unavailable' };
        case 'usersDisabled':
          return users
            ? { ...base, count: users.disabled, state: 'ok' }
            : { ...base, state: 'unavailable' };
        case 'runtime':
          return { ...base, state: 'ok', detail: sources.runtime() };
      }
    }),
  );
  return { cards };
}

/** The real sources: existing repository methods only. Imported lazily. */
export async function defaultOverviewSources(): Promise<OverviewSources> {
  const [{ getPlannerRepository }, { getRepository }] = await Promise.all([
    import('@/server/planner/instance'),
    import('@/server/content/instance'),
  ]);
  return {
    pendingListings: async () =>
      (await (await getPlannerRepository()).listListingQueue()).filter((item) => item.listing.status === 'pending')
        .length,
    pendingReviews: async () => (await (await getPlannerRepository()).listReviewQueue('pending')).length,
    contentDrafts: async () => {
      const content = await getRepository();
      const [stories, reviews] = await Promise.all([
        content.listStories({ status: 'draft' }),
        content.listReviews({ status: 'draft' }),
      ]);
      return stories.length + reviews.length;
    },
    users: async () => {
      const list = await (await getPlannerRepository()).listUsers();
      const disabled = list.filter((user) => Boolean(user.bannedAt) || Boolean(user.deletedAt)).length;
      return { active: list.length - disabled, disabled };
    },
    runtime: () => {
      const planner = Boolean(process.env.PLANNER_DATABASE_URL?.trim());
      const content = Boolean(process.env.CONTENT_DATABASE_URL?.trim());
      return planner && content ? 'postgres' : planner || content ? 'mixed' : 'file';
    },
  };
}

/**
 * The payload depends on the role alone, so one short-lived entry per role
 * bounds the cost of the full-list reads to one per role per window, however
 * often the dashboard or the route is hit (security review of P07-11). Held on
 * `globalThis` so the page and route bundles share it; the stored promise also
 * collapses concurrent requests into one read.
 */
export { OVERVIEW_CACHE_TTL_MS };

type CacheEntry = { at: number; value: Promise<Overview> };
const overviewCache = (): Map<string, CacheEntry> => sharedCache() as Map<string, CacheEntry>;

/** For tests: forget cached payloads. */
export function resetOverviewCache(): void {
  invalidateOverviewCache();
}

export async function loadOverview(principal: Principal, now: number = Date.now()): Promise<Overview> {
  const cache = overviewCache();
  const hit = cache.get(principal.role);
  if (hit && now - hit.at < OVERVIEW_CACHE_TTL_MS) return hit.value;
  const value = defaultOverviewSources().then((sources) => buildOverview(principal, sources));
  cache.set(principal.role, { at: now, value });
  // buildOverview never rejects for a failing source; if loading the sources
  // itself fails, do not keep the failure for the whole window.
  value.catch(() => {
    if (cache.get(principal.role)?.value === value) cache.delete(principal.role);
  });
  return value;
}
