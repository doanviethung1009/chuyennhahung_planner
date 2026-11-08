import type { CostCategory } from '@/server/content/schemas';
import { perPersonVnd, scaleVnd, sumVnd } from './money';
import type { CostScope, Trip, TripActivity, TripDay, TripExpense } from './schemas';

/**
 * Trip budgeting. Pure functions over rows — nothing here reads or writes.
 *
 * Three numbers are tracked, and the whole design turns on keeping them apart:
 *
 * | Number | Built from | Answers |
 * |---|---|---|
 * | `targetTotalVnd` | the traveller's budget | what we meant to spend |
 * | `estimatedTotalVnd` | **activities only** | what the plan costs |
 * | `actualTotalVnd` | **expenses only** | what has been paid |
 *
 * ## Why they are never added together
 *
 * An activity estimate and an expense are two descriptions of the *same* money
 * at different times. "Cà phê Mê Linh, 250.000₫" planned, then "Mê Linh, paid
 * 310.000₫" — a system that summed both would report 560.000₫ spent on one
 * morning. So `estimatedTotalVnd` and `actualTotalVnd` are reported side by
 * side and never summed.
 *
 * `projectedTotalVnd` is the one figure that mixes them, and it does so without
 * double counting: an activity whose id appears on an expense is **settled**
 * and contributes nothing further, so the projection is every payment made plus
 * the estimate of every activity not yet paid for. Linking an expense to its
 * activity is therefore what keeps the forecast honest, and is why
 * `TripExpense.activityId` exists.
 *
 * ## Group vs per person
 *
 * Every money row carries a `costScope`. `per_person` amounts are multiplied by
 * the party size exactly once, here, on the way into a total. Totals are always
 * whole-party; `perPerson` is derived back out at the end for display.
 */

export interface BudgetCategoryLine {
  category: CostCategory;
  estimatedVnd: number;
  actualVnd: number;
}

export interface BudgetDayLine {
  dayId: string;
  dayNumber: number;
  estimatedVnd: number;
  actualVnd: number;
}

export interface BudgetActivityLine {
  activityId: string;
  estimatedVnd: number;
  actualVnd: number;
  /** True once at least one expense points at this activity. */
  settled: boolean;
}

export interface TripBudgetSummary {
  currency: 'VND';
  partySize: number;
  targetTotalVnd: number;
  /** Plan cost: every activity, normalised to the whole party. */
  estimatedTotalVnd: number;
  /** Money paid: every expense, normalised to the whole party. */
  actualTotalVnd: number;
  /** Paid + the estimate of everything not yet paid for. Never double counts. */
  projectedTotalVnd: number;
  /** Target minus what has actually been paid. Negative once overspent. */
  remainingVnd: number;
  /** Projection minus target. Positive means the plan does not fit the budget. */
  varianceVnd: number;
  overBudget: boolean;
  perPerson: {
    targetVnd: number;
    estimatedVnd: number;
    actualVnd: number;
    projectedVnd: number;
  };
  activityCount: number;
  settledActivityCount: number;
  expenseCount: number;
  byCategory: BudgetCategoryLine[];
  byDay: BudgetDayLine[];
  byActivity: BudgetActivityLine[];
  /** Expenses with no day — flights, a hotel booked as one line. */
  unassignedActualVnd: number;
}

/** The one place a `per_person` amount becomes a whole-party amount. */
export function toGroupVnd(amount: number, scope: CostScope, partySize: number): number {
  return scope === 'per_person' ? scaleVnd(amount, partySize, 'costScope') : amount;
}

export function computeTripBudget(
  trip: Trip,
  days: readonly TripDay[],
  activities: readonly TripActivity[],
  expenses: readonly TripExpense[],
): TripBudgetSummary {
  const { partySize } = trip;
  const group = (amount: number, scope: CostScope) => toGroupVnd(amount, scope, partySize);

  const estimatedByActivity = new Map<string, number>();
  const actualByActivity = new Map<string, number>();
  const estimatedByDay = new Map<string, number>();
  const actualByDay = new Map<string, number>();
  const estimatedByCategory = new Map<CostCategory, number>();
  const actualByCategory = new Map<CostCategory, number>();

  const add = <K>(map: Map<K, number>, key: K, amount: number) => {
    map.set(key, (map.get(key) ?? 0) + amount);
  };

  for (const activity of activities) {
    const amount = group(activity.estimatedCostVnd, activity.costScope);
    estimatedByActivity.set(activity.id, amount);
    add(estimatedByDay, activity.dayId, amount);
    add(estimatedByCategory, activity.category, amount);
  }

  let unassignedActualVnd = 0;
  for (const expense of expenses) {
    const amount = group(expense.amountVnd, expense.costScope);
    add(actualByCategory, expense.category, amount);
    if (expense.dayId === null) unassignedActualVnd += amount;
    else add(actualByDay, expense.dayId, amount);
    // An expense marks its activity settled even at 0 đồng — "this was free
    // after all" is information, not a missing payment.
    if (expense.activityId !== null) add(actualByActivity, expense.activityId, amount);
  }

  const estimatedTotalVnd = sumVnd([...estimatedByActivity.values()], 'estimatedTotalVnd');
  const actualTotalVnd = sumVnd(
    expenses.map((expense) => group(expense.amountVnd, expense.costScope)),
    'actualTotalVnd',
  );

  // The projection: every payment, plus the estimate of every activity nobody has
  // paid for yet. Settled activities are skipped, which is what stops an
  // activity and its expense being counted twice.
  const unsettledEstimate = sumVnd(
    [...estimatedByActivity.entries()]
      .filter(([activityId]) => !actualByActivity.has(activityId))
      .map(([, amount]) => amount),
    'projectedTotalVnd',
  );
  const projectedTotalVnd = sumVnd([actualTotalVnd, unsettledEstimate], 'projectedTotalVnd');

  const targetTotalVnd = trip.budget.targetTotalVnd;
  const categories = new Set<CostCategory>([
    ...estimatedByCategory.keys(),
    ...actualByCategory.keys(),
  ]);

  return {
    currency: 'VND',
    partySize,
    targetTotalVnd,
    estimatedTotalVnd,
    actualTotalVnd,
    projectedTotalVnd,
    remainingVnd: targetTotalVnd - actualTotalVnd,
    varianceVnd: projectedTotalVnd - targetTotalVnd,
    overBudget: projectedTotalVnd > targetTotalVnd,
    perPerson: {
      targetVnd: perPersonVnd(targetTotalVnd, partySize),
      estimatedVnd: perPersonVnd(estimatedTotalVnd, partySize),
      actualVnd: perPersonVnd(actualTotalVnd, partySize),
      projectedVnd: perPersonVnd(projectedTotalVnd, partySize),
    },
    activityCount: activities.length,
    settledActivityCount: [...estimatedByActivity.keys()].filter((id) =>
      actualByActivity.has(id),
    ).length,
    expenseCount: expenses.length,
    byCategory: [...categories]
      .sort((a, b) => a.localeCompare(b))
      .map((category) => ({
        category,
        estimatedVnd: estimatedByCategory.get(category) ?? 0,
        actualVnd: actualByCategory.get(category) ?? 0,
      })),
    byDay: [...days]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((day) => ({
        dayId: day.id,
        dayNumber: day.dayNumber,
        estimatedVnd: estimatedByDay.get(day.id) ?? 0,
        actualVnd: actualByDay.get(day.id) ?? 0,
      })),
    byActivity: activities.map((activity) => ({
      activityId: activity.id,
      estimatedVnd: estimatedByActivity.get(activity.id) ?? 0,
      actualVnd: actualByActivity.get(activity.id) ?? 0,
      settled: actualByActivity.has(activity.id),
    })),
    unassignedActualVnd,
  };
}
