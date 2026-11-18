import type { ListingQueueItem, ReviewQueueItem } from '@/server/planner/schemas';

/**
 * Pure helpers for the moderation workspace (P07-14). No React, no fetching:
 * ordering, grouping and counts live here so they can be unit tested.
 */

/** Fixed triage order of `/admin/community`: the order of the page and of the jump links. */
export const SECTION_ORDER = ['trips', 'reviews', 'held', 'reports', 'restrictions'] as const;
export type SectionKey = (typeof SECTION_ORDER)[number];

/** Counts as reported by each queue once it has loaded; `null` = not loaded or not a plain count. */
export type SectionCounts = Record<SectionKey, number | null>;

export const EMPTY_COUNTS: SectionCounts = { trips: null, reviews: null, held: null, reports: null, restrictions: null };

/** The anchor id of a section; the jump links and the sections both use it. */
export function sectionId(key: SectionKey): string {
  return `section-${key}`;
}

/** Sections shown to this staff member, in fixed order. Restrictions need `community:restrict`. */
export function visibleSections(canRestrict: boolean): SectionKey[] {
  return SECTION_ORDER.filter((key) => key !== 'restrictions' || canRestrict);
}

/** Trips split into the ones awaiting a decision and the already decided, API order kept inside each group. */
export function splitTrips(items: readonly ListingQueueItem[]): { pending: ListingQueueItem[]; decided: ListingQueueItem[] } {
  return {
    pending: items.filter((item) => item.listing.status === 'pending'),
    decided: items.filter((item) => item.listing.status !== 'pending'),
  };
}

/** Reviews split into pending, held and the rest (live, rejected, removed), API order kept inside each group. */
export function splitReviews(items: readonly ReviewQueueItem[]): {
  pending: ReviewQueueItem[];
  held: ReviewQueueItem[];
  other: ReviewQueueItem[];
} {
  return {
    pending: items.filter((item) => item.status === 'pending'),
    held: items.filter((item) => item.status === 'held'),
    other: items.filter((item) => item.status !== 'pending' && item.status !== 'held'),
  };
}

/** The count a reports list may announce: only the open list is a to-do count; a filtered archive is not. */
export function reportCount(status: string, listed: number): number | null {
  return status === 'open' ? listed : null;
}
