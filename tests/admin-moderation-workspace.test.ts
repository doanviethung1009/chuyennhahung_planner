import { describe, expect, it } from 'vitest';
import {
  SECTION_ORDER,
  reportCount,
  sectionId,
  splitReviews,
  splitTrips,
  visibleSections,
} from '../src/components/admin/community/workspace-model';
import type { ListingQueueItem, ReviewQueueItem } from '../src/server/planner/schemas';

const trip = (tripId: string, status: string) => ({ tripId, listing: { status } }) as unknown as ListingQueueItem;
const review = (id: string, status: string) => ({ id, status }) as unknown as ReviewQueueItem;

describe('moderation workspace model (P07-14)', () => {
  it('keeps the fixed triage order', () => {
    expect([...SECTION_ORDER]).toEqual(['trips', 'reviews', 'held', 'reports', 'restrictions']);
  });

  it('hides restrictions without community:restrict, keeping the order', () => {
    expect(visibleSections(true, 1)).toEqual([...SECTION_ORDER]);
    expect(visibleSections(false, 1)).toEqual(['trips', 'reviews', 'held', 'reports']);
  });

  it('shows the pending reviews section only while legacy pending reviews exist', () => {
    expect(visibleSections(true)).toEqual(['trips', 'held', 'reports', 'restrictions']);
    expect(visibleSections(false, 0)).toEqual(['trips', 'held', 'reports']);
    expect(visibleSections(false, 2)).toContain('reviews');
  });

  it('gives each section a distinct anchor id', () => {
    const ids = SECTION_ORDER.map(sectionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^section-[a-z]+$/.test(id))).toBe(true);
  });

  it('splits trips into pending and decided without losing or reordering any', () => {
    const items = [trip('a', 'pending'), trip('b', 'approved'), trip('c', 'pending'), trip('d', 'rejected')];
    const { pending, decided } = splitTrips(items);
    expect(pending.map((i) => i.tripId)).toEqual(['a', 'c']);
    expect(decided.map((i) => i.tripId)).toEqual(['b', 'd']);
    expect(pending.length + decided.length).toBe(items.length);
  });

  it('splits reviews into pending, held and other; counts add up to the list length', () => {
    const items = [
      review('1', 'pending'),
      review('2', 'held'),
      review('3', 'approved'),
      review('4', 'pending'),
      review('5', 'removed'),
      review('6', 'rejected'),
    ];
    const { pending, held, other } = splitReviews(items);
    expect(pending.map((i) => i.id)).toEqual(['1', '4']);
    expect(held.map((i) => i.id)).toEqual(['2']);
    expect(other.map((i) => i.id)).toEqual(['3', '5', '6']);
    expect(pending.length + held.length + other.length).toBe(items.length);
  });

  it('handles empty lists', () => {
    expect(splitTrips([])).toEqual({ pending: [], decided: [] });
    expect(splitReviews([])).toEqual({ pending: [], held: [], other: [] });
  });

  it('announces a report count only for the open list', () => {
    expect(reportCount('open', 3)).toBe(3);
    expect(reportCount('actioned', 3)).toBeNull();
    expect(reportCount('dismissed', 0)).toBeNull();
  });
});
