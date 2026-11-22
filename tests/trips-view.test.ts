import { describe, expect, it } from 'vitest';
import { DEFAULT_TRIPS_VIEW, TRIPS_VIEWS, parseTripsView } from '../src/lib/trips-view';

describe('parseTripsView', () => {
  it('accepts exactly the known views and defaults to active', () => {
    expect(TRIPS_VIEWS).toEqual(['active', 'archived']);
    expect(parseTripsView('archived')).toBe('archived');
    expect(parseTripsView('active')).toBe('active');
    for (const raw of [undefined, '', 'ARCHIVED', 'deleted', '<script>']) expect(parseTripsView(raw)).toBe(DEFAULT_TRIPS_VIEW);
  });

  it('uses the first value of a repeated parameter', () => {
    expect(parseTripsView(['archived', 'active'])).toBe('archived');
    expect(parseTripsView(['x', 'archived'])).toBe('active');
  });
});
