import { describe, expect, it } from 'vitest';
import {
  tripActivityUpdateSchema,
  tripDayUpdateSchema,
  tripExpenseUpdateSchema,
  tripUpdateSchema,
} from '../src/server/planner/schemas';
import { daLatTripInput, makeOwner, makePlanner } from './planner-helpers';

/**
 * Regression: Zod 4 applies a `.default()` even inside `.partial()`, so the
 * PATCH schemas — derived from the create schemas — used to fill every field
 * the client did not send with its create-time default. A PATCH of one field
 * (`{ planningStatus: 'planned' }`) wiped the trip's start date, style, pace
 * and note. A PATCH must carry only what the client sent.
 */
describe('PATCH schemas carry only the fields that were sent', () => {
  it.each([
    ['trip', tripUpdateSchema],
    ['day', tripDayUpdateSchema],
    ['activity', tripActivityUpdateSchema],
    ['expense', tripExpenseUpdateSchema],
  ] as const)('%s: an empty patch parses to an empty object', (_name, schema) => {
    expect(schema.parse({})).toEqual({});
  });

  it('a one-field trip patch stays one field', () => {
    expect(tripUpdateSchema.parse({ planningStatus: 'planned' })).toEqual({
      planningStatus: 'planned',
    });
  });

  it('an explicit null still clears a nullable field', () => {
    expect(tripUpdateSchema.parse({ startDate: null })).toEqual({ startDate: null });
  });

  it('changing the planning status keeps the dates, style, pace and note', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(
      userId,
      daLatTripInput({ travelStyle: 'romantic', pace: 'relaxed', note: 'Nhớ mang áo ấm' }),
    );

    const patch = tripUpdateSchema.parse({ planningStatus: 'planned' });
    const { trip: updated, days } = await planner.updateTrip(userId, trip.id, patch, trip.version);

    expect(updated.planningStatus).toBe('planned');
    expect(updated.startDate).toBe(trip.startDate);
    expect(updated.endDate).toBe(trip.endDate);
    expect(updated.travelStyle).toBe('romantic');
    expect(updated.pace).toBe('relaxed');
    expect(updated.note).toBe('Nhớ mang áo ấm');
    expect(days.every((day) => day.date !== null)).toBe(true);
  });
});
