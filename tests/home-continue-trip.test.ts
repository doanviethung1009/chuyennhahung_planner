import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  pickContinueTrip,
  vietnamToday,
  type PickableTrip,
} from '../src/lib/home/continue-trip';

const trip = (id: string, over: Partial<PickableTrip> = {}): PickableTrip => ({
  id,
  startDate: null,
  planningStatus: 'draft',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...over,
});

const TODAY = '2026-06-10';

describe('pickContinueTrip', () => {
  it('returns null when there is nothing to continue', () => {
    expect(pickContinueTrip([], TODAY)).toBeNull();
    expect(pickContinueTrip([trip('a', { planningStatus: 'completed' })], TODAY)).toBeNull();
  });

  it('never chooses a completed trip', () => {
    const picked = pickContinueTrip(
      [trip('done', { planningStatus: 'completed', startDate: '2026-06-11' }), trip('open')],
      TODAY,
    );
    expect(picked?.id).toBe('open');
  });

  it('prefers the earliest upcoming date over undated and past trips', () => {
    const picked = pickContinueTrip(
      [
        trip('undated', { updatedAt: '2026-06-09T00:00:00.000Z' }),
        trip('past', { startDate: '2026-06-01' }),
        trip('later', { startDate: '2026-08-01' }),
        trip('soon', { startDate: '2026-06-12' }),
      ],
      TODAY,
    );
    expect(picked?.id).toBe('soon');
  });

  it('counts a trip that leaves today as upcoming', () => {
    const picked = pickContinueTrip(
      [trip('today', { startDate: TODAY }), trip('undated')],
      TODAY,
    );
    expect(picked?.id).toBe('today');
  });

  it('prefers the most recently updated undated trip next', () => {
    const picked = pickContinueTrip(
      [
        trip('old', { updatedAt: '2026-01-01T00:00:00.000Z' }),
        trip('fresh', { updatedAt: '2026-05-01T00:00:00.000Z' }),
        trip('past', { startDate: '2026-06-01', updatedAt: '2026-06-09T00:00:00.000Z' }),
      ],
      TODAY,
    );
    expect(picked?.id).toBe('fresh');
  });

  it('falls back to the most recently updated past-dated trip', () => {
    const picked = pickContinueTrip(
      [
        trip('a', { startDate: '2026-05-01', updatedAt: '2026-05-02T00:00:00.000Z' }),
        trip('b', { startDate: '2026-04-01', updatedAt: '2026-06-02T00:00:00.000Z' }),
      ],
      TODAY,
    );
    expect(picked?.id).toBe('b');
  });

  it('breaks every tie deterministically, whatever the input order', () => {
    const a = trip('a', { startDate: '2026-07-01' });
    const b = trip('b', { startDate: '2026-07-01' });
    expect(pickContinueTrip([b, a], TODAY)?.id).toBe('a');
    expect(pickContinueTrip([a, b], TODAY)?.id).toBe('a');

    const newer = trip('z', { startDate: '2026-07-01', updatedAt: '2026-06-01T00:00:00.000Z' });
    expect(pickContinueTrip([a, newer], TODAY)?.id).toBe('z');
  });

  it('does not mutate its input', () => {
    const input = [trip('b', { startDate: '2026-07-02' }), trip('a', { startDate: '2026-07-01' })];
    const copy = [...input];
    pickContinueTrip(input, TODAY);
    expect(input).toEqual(copy);
  });
});

describe('day maths', () => {
  it('counts whole calendar days', () => {
    expect(daysUntil('2026-06-10', '2026-06-10')).toBe(0);
    expect(daysUntil('2026-06-22', '2026-06-10')).toBe(12);
    expect(daysUntil('2026-06-01', '2026-06-10')).toBe(-9);
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
  });

  it('reads the date in Vietnam, not in UTC', () => {
    // 18:30 UTC on 9 June is already 10 June, 01:30 in Vietnam.
    expect(vietnamToday(new Date('2026-06-09T18:30:00Z'))).toBe('2026-06-10');
    expect(vietnamToday(new Date('2026-06-09T16:59:00Z'))).toBe('2026-06-09');
  });
});
