import { describe, expect, it } from 'vitest';
import { DEFAULT_TRIPS_FILTER, TRIPS_Q_MAX, parseTripsFilter, withTripsFilter } from '../src/lib/trips-filter';

describe('parseTripsFilter', () => {
  it('defaults when nothing is given', () => {
    expect(parseTripsFilter({})).toEqual(DEFAULT_TRIPS_FILTER);
  });
  it('keeps known values and trims q', () => {
    expect(parseTripsFilter({ q: '  đà lạt ', status: 'planned', sort: 'title' })).toEqual({ q: 'đà lạt', status: 'planned', sort: 'title' });
  });
  it('drops unknown status and sort, cuts q, uses the first of repeated values', () => {
    const p = parseTripsFilter({ q: ['a'.repeat(200), 'x'], status: 'bogus', sort: ['start', 'title'] });
    expect(p.q).toHaveLength(TRIPS_Q_MAX);
    expect(p).toMatchObject({ status: 'all', sort: 'start' });
  });
});

describe('withTripsFilter', () => {
  it('keeps tab and view, adds only non-default filters', () => {
    expect(withTripsFilter('?tab=trips&view=archived', { q: 'huế', status: 'all', sort: 'start' })).toBe(
      '?tab=trips&view=archived&q=hu%E1%BA%BF&sort=start',
    );
  });
  it('replaces earlier filter keys and drops defaults for a clean URL', () => {
    expect(withTripsFilter('?tab=trips&q=old&status=draft&sort=title', DEFAULT_TRIPS_FILTER)).toBe('?tab=trips');
    expect(withTripsFilter('', DEFAULT_TRIPS_FILTER)).toBe('');
  });
  it('round-trips through parseTripsFilter', () => {
    const filter = { q: 'a&b=c', status: 'completed', sort: 'title' } as const;
    const params = new URLSearchParams(withTripsFilter('?tab=trips', filter));
    expect(parseTripsFilter({ q: params.get('q') ?? '', status: params.get('status') ?? '', sort: params.get('sort') ?? '' })).toEqual(filter);
  });
});
