import { describe, expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import {
  MAX_VND,
  jsonSafe,
  normalizeVnd,
  perPersonVnd,
  scaleVnd,
  sumVnd,
} from '../src/server/planner/money';
import {
  activityInput,
  daLatTripInput,
  expenseInput,
  makeOwner,
  makePlanner,
} from './planner-helpers';

/**
 * The budget rules from the brief, stated as tests: group vs per-person must
 * not be confused, and an activity and the expense that paid for it must never
 * be added together.
 */

async function setup() {
  const planner = makePlanner();
  const { userId } = await makeOwner(planner);
  const { trip } = await planner.createTrip(userId, daLatTripInput());
  return { planner, userId, tripId: trip.id };
}

describe('group vs per-person costs', () => {
  it('scales a per-person amount by the party size exactly once', async () => {
    const { planner, userId, tripId } = await setup();

    // 2 people. 300.000 for the group, plus 400.000 each.
    await planner.addActivity(
      userId,
      tripId,
      activityInput({ title: 'Thuê xe', estimatedCostVnd: 300_000, costScope: 'group' }),
      null,
    );
    const view = await planner.addActivity(
      userId,
      tripId,
      activityInput({ title: 'Vé vào cổng', estimatedCostVnd: 400_000, costScope: 'per_person' }),
      null,
    );

    // 300.000 + (400.000 × 2) = 1.100.000
    expect(view.budget.estimatedTotalVnd).toBe(1_100_000);
    expect(view.budget.partySize).toBe(2);
    expect(view.budget.perPerson.estimatedVnd).toBe(550_000);
  });

  it('re-scales every per-person amount when the party size changes', async () => {
    const { planner, userId, tripId } = await setup();
    const added = await planner.addActivity(
      userId,
      tripId,
      activityInput({ estimatedCostVnd: 500_000, costScope: 'per_person' }),
      null,
    );
    expect(added.budget.estimatedTotalVnd).toBe(1_000_000);

    const grown = await planner.updateTrip(
      userId,
      tripId,
      { partySize: 5 },
      added.trip.version,
    );

    // Nothing was stored as a total, so the figure simply follows the party.
    expect(grown.budget.estimatedTotalVnd).toBe(2_500_000);
  });

  it('scales a per-person expense the same way', async () => {
    const { planner, userId, tripId } = await setup();
    const view = await planner.addExpense(
      userId,
      tripId,
      expenseInput({ amountVnd: 250_000, costScope: 'per_person' }),
      null,
    );

    expect(view.budget.actualTotalVnd).toBe(500_000);
    expect(view.budget.perPerson.actualVnd).toBe(250_000);
  });
});

describe('activity and expense are never double counted', () => {
  it('keeps the plan and the payment as two separate figures', async () => {
    const { planner, userId, tripId } = await setup();

    const added = await planner.addActivity(
      userId,
      tripId,
      activityInput({ title: 'Cà phê Mê Linh', estimatedCostVnd: 250_000 }),
      null,
    );
    const activityId = added.days[0]!.activities[0]!.id;

    const paid = await planner.addExpense(
      userId,
      tripId,
      expenseInput({ label: 'Mê Linh', amountVnd: 310_000, activityId }),
      null,
    );

    const { budget } = paid;
    expect(budget.estimatedTotalVnd).toBe(250_000);
    expect(budget.actualTotalVnd).toBe(310_000);
    // The projection counts the payment and drops the estimate it replaced —
    // 560.000 would be the double-counted answer.
    expect(budget.projectedTotalVnd).toBe(310_000);
    expect(budget.settledActivityCount).toBe(1);
    expect(budget.byActivity[0]).toMatchObject({
      activityId,
      estimatedVnd: 250_000,
      actualVnd: 310_000,
      settled: true,
    });
  });

  it('projects the estimate of anything not yet paid for, alongside what was', async () => {
    const { planner, userId, tripId } = await setup();

    const first = await planner.addActivity(
      userId,
      tripId,
      activityInput({ title: 'Đã trả', estimatedCostVnd: 250_000 }),
      null,
    );
    await planner.addActivity(
      userId,
      tripId,
      activityInput({ title: 'Chưa trả', estimatedCostVnd: 600_000, dayNumber: 2 }),
      null,
    );
    const settledId = first.days[0]!.activities[0]!.id;

    const view = await planner.addExpense(
      userId,
      tripId,
      expenseInput({ amountVnd: 310_000, activityId: settledId }),
      null,
    );

    expect(view.budget.estimatedTotalVnd).toBe(850_000);
    expect(view.budget.actualTotalVnd).toBe(310_000);
    // 310.000 paid + 600.000 still to come.
    expect(view.budget.projectedTotalVnd).toBe(910_000);
  });

  it('treats a zero-đồng expense as settling the activity', async () => {
    const { planner, userId, tripId } = await setup();
    const added = await planner.addActivity(
      userId,
      tripId,
      activityInput({ estimatedCostVnd: 200_000 }),
      null,
    );
    const activityId = added.days[0]!.activities[0]!.id;

    const view = await planner.addExpense(
      userId,
      tripId,
      expenseInput({ label: 'Được mời', amountVnd: 0, activityId }),
      null,
    );

    // "It turned out to be free" is information, not a missing payment.
    expect(view.budget.projectedTotalVnd).toBe(0);
    expect(view.budget.settledActivityCount).toBe(1);
  });

  it('counts an unlinked expense as extra spending on top of the plan', async () => {
    const { planner, userId, tripId } = await setup();
    await planner.addActivity(
      userId,
      tripId,
      activityInput({ estimatedCostVnd: 200_000 }),
      null,
    );
    const view = await planner.addExpense(
      userId,
      tripId,
      expenseInput({ label: 'Mua quà', amountVnd: 500_000, category: 'shopping' }),
      null,
    );

    // Nothing was settled, so the plan still counts in full.
    expect(view.budget.projectedTotalVnd).toBe(700_000);
    expect(view.budget.settledActivityCount).toBe(0);
  });
});

describe('budget against the target', () => {
  it('reports what is left, and flags the plan that does not fit', async () => {
    const { planner, userId, tripId } = await setup();

    const view = await planner.addExpense(
      userId,
      tripId,
      expenseInput({ label: 'Khách sạn', category: 'stay', amountVnd: 1_800_000 }),
      null,
    );

    expect(view.budget.targetTotalVnd).toBe(5_000_000);
    expect(view.budget.remainingVnd).toBe(3_200_000);
    expect(view.budget.overBudget).toBe(false);

    const over = await planner.addActivity(
      userId,
      tripId,
      activityInput({ estimatedCostVnd: 4_000_000 }),
      null,
    );

    expect(over.budget.projectedTotalVnd).toBe(5_800_000);
    expect(over.budget.varianceVnd).toBe(800_000);
    expect(over.budget.overBudget).toBe(true);
    expect(over.budget.overrunVnd).toBe(800_000);
    expect(over.budget.perPerson.overrunVnd).toBe(Math.ceil(800_000 / over.budget.partySize));
    expect(view.budget.overrunVnd).toBe(0);
    // Only 1.800.000 has actually left the wallet.
    expect(over.budget.remainingVnd).toBe(3_200_000);
  });

  it('breaks the trip down by category and by day, and keeps trip-level costs apart', async () => {
    const { planner, userId, tripId } = await setup();

    await planner.addActivity(
      userId,
      tripId,
      activityInput({ estimatedCostVnd: 90_000, category: 'food', dayNumber: 1 }),
      null,
    );
    await planner.addActivity(
      userId,
      tripId,
      activityInput({ estimatedCostVnd: 160_000, category: 'tickets', dayNumber: 2 }),
      null,
    );
    await planner.addExpense(
      userId,
      tripId,
      expenseInput({ label: 'Ăn sáng', category: 'food', amountVnd: 100_000, dayNumber: 1 }),
      null,
    );
    const view = await planner.addExpense(
      userId,
      tripId,
      // No day: a flight booked as one line for the whole trip.
      expenseInput({ label: 'Vé xe', category: 'transport', amountVnd: 700_000 }),
      null,
    );

    expect(view.budget.byCategory).toEqual([
      { category: 'food', estimatedVnd: 90_000, actualVnd: 100_000 },
      { category: 'tickets', estimatedVnd: 160_000, actualVnd: 0 },
      { category: 'transport', estimatedVnd: 0, actualVnd: 700_000 },
    ]);
    expect(view.budget.byDay).toEqual([
      { dayId: view.days[0]!.id, dayNumber: 1, estimatedVnd: 90_000, actualVnd: 100_000 },
      { dayId: view.days[1]!.id, dayNumber: 2, estimatedVnd: 160_000, actualVnd: 0 },
      { dayId: view.days[2]!.id, dayNumber: 3, estimatedVnd: 0, actualVnd: 0 },
    ]);
    // The trip-level cost is in the total but on no day.
    expect(view.budget.unassignedActualVnd).toBe(700_000);
    expect(view.budget.actualTotalVnd).toBe(800_000);
  });
});

describe('money handling', () => {
  const code = (fn: () => unknown): string => {
    try {
      fn();
    } catch (error) {
      return isContentError(error) ? error.code : 'not-a-content-error';
    }
    return 'resolved';
  };

  it('accepts the three shapes a BIGINT column can arrive as', () => {
    expect(normalizeVnd(5_000_000)).toBe(5_000_000);
    expect(normalizeVnd(5_000_000n)).toBe(5_000_000);
    expect(normalizeVnd('5000000')).toBe(5_000_000);
    expect(normalizeVnd(' 5000000 ')).toBe(5_000_000);
  });

  it('refuses a value that a double cannot represent exactly', () => {
    // Checked as a BigInt before conversion: Number() would round first.
    expect(code(() => normalizeVnd(9_007_199_254_740_993n))).toBe('validation_failed');
    expect(code(() => normalizeVnd('99999999999999999999'))).toBe('validation_failed');
  });

  it('refuses floats, negatives, nonsense and implausible amounts', () => {
    expect(code(() => normalizeVnd(1.5))).toBe('validation_failed');
    expect(code(() => normalizeVnd(-1))).toBe('validation_failed');
    expect(code(() => normalizeVnd('5.000.000'))).toBe('validation_failed');
    expect(code(() => normalizeVnd(null))).toBe('validation_failed');
    expect(code(() => normalizeVnd(MAX_VND + 1))).toBe('validation_failed');
  });

  it('serializes a bigint anywhere in a response body', () => {
    const payload = {
      budget: { targetTotalVnd: 5_000_000n },
      rows: [{ amountVnd: 250_000n }, { amountVnd: 0 }],
      untouched: 'Đà Lạt',
    };

    expect(jsonSafe(payload)).toEqual({
      budget: { targetTotalVnd: 5_000_000 },
      rows: [{ amountVnd: 250_000 }, { amountVnd: 0 }],
      untouched: 'Đà Lạt',
    });
    // The point of the exercise: this would throw on a raw bigint.
    expect(() => JSON.stringify(jsonSafe(payload))).not.toThrow();
  });

  it('guards the arithmetic, not just the inputs', () => {
    expect(sumVnd([1_000, 2_000, 3_000])).toBe(6_000);
    expect(code(() => sumVnd([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]))).toBe(
      'validation_failed',
    );
    expect(scaleVnd(400_000, 3)).toBe(1_200_000);
    expect(code(() => scaleVnd(Number.MAX_SAFE_INTEGER, 50))).toBe('validation_failed');
    expect(perPersonVnd(1_000_000, 3)).toBe(333_333);
    expect(perPersonVnd(1_000_000, 0)).toBe(0);
  });
});
