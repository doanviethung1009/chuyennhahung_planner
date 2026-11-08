import { describe, expect, it } from 'vitest';
import type { IntegrityIssue } from '../src/server/content/repository';
import type { PlannerRepository } from '../src/server/planner/repository';
import { createMemoryPlannerStore, type PlannerStore } from '../src/server/planner/store';
import {
  activityInput,
  daLatTripInput,
  expenseInput,
  makeOwner,
  makePlanner,
  makeSeededPlanner,
} from './planner-helpers';

/**
 * The Planner's integrity sweep. The JSON store enforces no foreign keys and no
 * unique constraints, so each test here breaks one invariant the write paths
 * guarantee — the way a hand-edited `planner.json` would — and asserts the
 * sweep names it.
 *
 * Corruption is applied by writing straight to the store, bypassing the
 * repository, because that is exactly the threat model.
 */

/** Issues matching an entity whose text contains `fragment`. */
function matching(issues: IntegrityIssue[], entity: string, fragment: string): IntegrityIssue[] {
  return issues.filter((issue) => issue.entity === entity && issue.issue.includes(fragment));
}

function expectOne(issues: IntegrityIssue[], entity: string, fragment: string): IntegrityIssue {
  const found = matching(issues, entity, fragment);
  expect(
    found,
    `expected exactly one ${entity} issue containing "${fragment}", got ${JSON.stringify(issues)}`,
  ).toHaveLength(1);
  return found[0]!;
}

/** A healthy three-day trip with an activity and a linked expense. */
async function seedTrip(): Promise<{
  planner: PlannerRepository;
  store: PlannerStore;
  userId: string;
  tripId: string;
  activityId: string;
  expenseId: string;
}> {
  const store = createMemoryPlannerStore();
  const planner = makePlanner({ store });
  const { userId } = await makeOwner(planner);
  const created = await planner.createTrip(userId, daLatTripInput());
  const withActivity = await planner.addActivity(
    userId,
    created.trip.id,
    activityInput({ placeSlug: 'ho-xuan-huong', estimatedCostVnd: 0 }),
    null,
  );
  const activityId = withActivity.days[0]!.activities[0]!.id;
  const withExpense = await planner.addExpense(
    userId,
    created.trip.id,
    expenseInput({ activityId }),
    null,
  );

  return {
    planner,
    store,
    userId,
    tripId: created.trip.id,
    activityId,
    expenseId: withExpense.expenses[0]!.id,
  };
}

/** Breaks the store behind the repository's back. */
async function corrupt(
  store: PlannerStore,
  mutate: (data: Awaited<ReturnType<PlannerStore['read']>>) => void,
): Promise<void> {
  const data = await store.read();
  mutate(data);
  await store.write(data);
}

describe('a healthy document reports nothing', () => {
  it('finds no issue in a trip built through the repository', async () => {
    const { planner } = await seedTrip();
    expect(await planner.validateIntegrity()).toEqual([]);
  });

  it('finds no issue in a trip cloned from the real seeded template', async () => {
    const { planner } = await makeSeededPlanner();
    const { userId } = await makeOwner(planner);
    await planner.createTrip(userId, {
      source: 'template',
      templateSlug: 'da-lat-3-ngay-lang-man',
      startDate: '2026-04-10',
      partySize: 2,
      budget: { targetTotalVnd: 5_000_000, currency: 'VND' },
      note: null,
    });

    expect(await planner.validateIntegrity()).toEqual([]);
  });

  it('finds no issue in an empty document', async () => {
    const planner = makePlanner();
    expect(await planner.validateIntegrity()).toEqual([]);
  });
});

describe('trips', () => {
  it('catches an owner and a destination that do not exist', async () => {
    const { planner, store, tripId } = await seedTrip();
    await corrupt(store, (data) => {
      data.trips[0]!.ownerId = 'usr_vanished';
      data.trips[0]!.destinationSlug = 'sao-hoa';
    });

    const issues = await planner.validateIntegrity();
    expect(expectOne(issues, 'trip', 'unknown owner').id).toBe(tripId);
    expectOne(issues, 'trip', 'unknown destination "sao-hoa"');
  });

  it('catches an endDate that disagrees with the start date and duration', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.trips[0]!.endDate = '2026-04-20';
    });

    expectOne(await planner.validateIntegrity(), 'trip', 'endDate "2026-04-20" disagrees');
  });

  it('catches an archived trip with no archivedAt, and the reverse', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.trips[0]!.status = 'archived';
      data.trips[0]!.archivedAt = null;
    });
    expectOne(await planner.validateIntegrity(), 'trip', 'archived with no archivedAt');

    await corrupt(store, (data) => {
      data.trips[0]!.status = 'active';
      data.trips[0]!.archivedAt = '2026-03-01T08:00:00.000Z';
    });
    expectOne(await planner.validateIntegrity(), 'trip', 'still carries an archivedAt');
  });

  it('catches a day count and a numbering that disagree with durationDays', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      // Remove the middle day: two rows left, numbered 1 and 3.
      data.tripDays = data.tripDays.filter((day) => day.dayNumber !== 2);
    });

    const issues = await planner.validateIntegrity();
    expectOne(issues, 'trip', 'has 2 day row(s) but durationDays is 3');
    expectOne(issues, 'trip', 'days are not numbered 1..n');
  });

  it('catches a version below 1', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.trips[0]!.version = 0;
    });

    expectOne(await planner.validateIntegrity(), 'trip', 'version 0 is below 1');
  });
});

describe('days', () => {
  it('catches a date that no longer matches the trip calendar', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.tripDays[1]!.date = '2020-01-01';
    });

    expectOne(
      await planner.validateIntegrity(),
      'trip day',
      'date "2020-01-01" disagrees with the trip\'s calendar ("2026-04-11")',
    );
  });

  it('catches a day past the end of its trip, and an orphan day', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.tripDays[2]!.dayNumber = 9;
      data.tripDays.push({ ...data.tripDays[0]!, id: 'day_orphan', tripId: 'trip_gone' });
    });

    const issues = await planner.validateIntegrity();
    expectOne(issues, 'trip day', "day 9 is past the trip's 3 day(s)");
    expect(expectOne(issues, 'trip day', 'orphan: unknown trip "trip_gone"').id).toBe(
      'day_orphan',
    );
  });
});

describe('activities', () => {
  it('catches an order gap within a day', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.tripActivities[0]!.order = 4;
    });

    expectOne(await planner.validateIntegrity(), 'trip day', 'activity order has a gap');
  });

  it('catches a duplicated order within a day', async () => {
    const { planner, store, userId, tripId } = await seedTrip();
    const current = await planner.getTrip(userId, tripId);
    await planner.addActivity(
      userId,
      tripId,
      activityInput({ title: 'Thứ hai' }),
      current.trip.version,
    );
    await corrupt(store, (data) => {
      data.tripActivities[1]!.order = 0;
    });

    expectOne(await planner.validateIntegrity(), 'trip day', 'activity order has a gap');
  });

  it('catches a place that is no longer in the catalog', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.tripActivities[0]!.placeSlug = 'quan-da-dong-cua';
    });

    expectOne(
      await planner.validateIntegrity(),
      'trip activity',
      'unknown place "quan-da-dong-cua"',
    );
  });

  it('catches a day that belongs to another trip, and an orphan activity', async () => {
    const { planner, store, userId } = await seedTrip();
    const other = await planner.createTrip(userId, daLatTripInput({ title: 'Chuyến khác' }));
    const otherDayId = other.days[0]!.id;

    await corrupt(store, (data) => {
      data.tripActivities[0]!.dayId = otherDayId;
      data.tripActivities.push({
        ...data.tripActivities[0]!,
        id: 'act_orphan',
        tripId: 'trip_gone',
      });
    });

    const issues = await planner.validateIntegrity();
    expectOne(issues, 'trip activity', 'belongs to a different trip');
    expect(expectOne(issues, 'trip activity', 'orphan: unknown trip "trip_gone"').id).toBe(
      'act_orphan',
    );
  });
});

describe('expenses', () => {
  it('catches an expense whose day disagrees with its activity', async () => {
    const { planner, store, expenseId } = await seedTrip();
    await corrupt(store, (data) => {
      // The write path derives this from the activity, so a mismatch means the
      // by-day budget totals are landing on the wrong day.
      data.tripExpenses[0]!.dayId = data.tripDays[2]!.id;
    });

    const issue = expectOne(await planner.validateIntegrity(), 'trip expense', 'disagrees with its activity');
    expect(issue.id).toBe(expenseId);
  });

  it('catches an unknown activity and an unknown day', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.tripExpenses[0]!.activityId = 'act_gone';
      data.tripExpenses[0]!.dayId = 'day_gone';
    });

    const issues = await planner.validateIntegrity();
    expectOne(issues, 'trip expense', 'unknown day "day_gone"');
    expectOne(issues, 'trip expense', 'unknown activity "act_gone"');
  });

  it('catches an activity that belongs to another trip, and an orphan expense', async () => {
    const { planner, store, userId } = await seedTrip();
    const other = await planner.createTrip(userId, daLatTripInput({ title: 'Chuyến khác' }));
    const withActivity = await planner.addActivity(
      userId,
      other.trip.id,
      activityInput(),
      null,
    );
    const foreignActivityId = withActivity.days[0]!.activities[0]!.id;

    await corrupt(store, (data) => {
      data.tripExpenses[0]!.activityId = foreignActivityId;
      data.tripExpenses.push({
        ...data.tripExpenses[0]!,
        id: 'exp_orphan',
        tripId: 'trip_gone',
      });
    });

    const issues = await planner.validateIntegrity();
    expectOne(issues, 'trip expense', 'belongs to a different trip');
    expect(expectOne(issues, 'trip expense', 'orphan: unknown trip "trip_gone"').id).toBe(
      'exp_orphan',
    );
  });
});

describe('users and uniqueness', () => {
  it('catches a duplicate handle and a duplicate id', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      const first = data.users[0]!;
      data.users.push({ ...first, id: 'usr_second' });
      data.trips.push({ ...data.trips[0]!, id: data.trips[0]!.id });
    });

    const issues = await planner.validateIntegrity();
    expectOne(issues, 'planner user', 'handle "hung-tran" appears on more than one row');
    expectOne(issues, 'trip', 'appears on more than one row');
  });

  it('catches a token digest of the wrong shape', async () => {
    const { planner, store } = await seedTrip();
    await corrupt(store, (data) => {
      data.users[0]!.tokenHash = 'plaintext-token-stored-by-mistake';
    });

    const issues = await planner.validateIntegrity();
    expectOne(issues, 'planner user', 'not a 64-character SHA-256 digest');
    // The bad value itself is never echoed back.
    expect(JSON.stringify(issues)).not.toContain('plaintext-token-stored-by-mistake');
  });
});

describe('the sweep reports identifiers, never trip content', () => {
  it('leaks no title, label, note or amount', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const { userId } = await makeOwner(planner);

    const created = await planner.createTrip(
      userId,
      daLatTripInput({
        title: 'Tuần trăng mật ở Đà Lạt',
        note: 'Đừng nói với ai về chuyến này.',
      }),
    );
    const withActivity = await planner.addActivity(
      userId,
      created.trip.id,
      activityInput({ title: 'Ăn tối riêng tư', estimatedCostVnd: 4_321_000 }),
      null,
    );
    await planner.addExpense(
      userId,
      created.trip.id,
      expenseInput({
        label: 'Nhẫn cưới',
        amountVnd: 1_234_000,
        activityId: withActivity.days[0]!.activities[0]!.id,
      }),
      null,
    );

    // Break several things at once, so most report paths run.
    await corrupt(store, (data) => {
      data.trips[0]!.ownerId = 'usr_vanished';
      data.trips[0]!.endDate = '2030-01-01';
      data.tripDays[0]!.date = '2020-01-01';
      data.tripActivities[0]!.order = 7;
      data.tripExpenses[0]!.dayId = data.tripDays[2]!.id;
      data.users[0]!.tokenHash = 'nope';
    });

    const issues = await planner.validateIntegrity();
    expect(issues.length).toBeGreaterThan(4);

    const serialized = JSON.stringify(issues);
    for (const secret of [
      'Tuần trăng mật ở Đà Lạt',
      'Đừng nói với ai',
      'Ăn tối riêng tư',
      'Nhẫn cưới',
      '4321000',
      '1234000',
    ]) {
      expect(serialized, `the sweep leaked "${secret}"`).not.toContain(secret);
    }
  });
});

describe('a template that moved on is information, not corruption', () => {
  it('reports a withdrawn template and a newer template version', async () => {
    const { planner, content } = await makeSeededPlanner();
    const { userId } = await makeOwner(planner);
    await planner.createTrip(userId, {
      source: 'template',
      templateSlug: 'da-lat-3-ngay-lang-man',
      startDate: '2026-04-10',
      partySize: 2,
      budget: { targetTotalVnd: 5_000_000, currency: 'VND' },
      note: null,
    });
    expect(await planner.validateIntegrity()).toEqual([]);

    // The editor edits the template. The clone is independent, so this is
    // staleness to be aware of, not damage.
    await content.updateTemplate('da-lat-3-ngay-lang-man', { pace: 'balanced' });
    expectOne(
      await planner.validateIntegrity(),
      'trip',
      'has moved on: cloned at version 1, now 2 (snapshot retained)',
    );

    // And when it is withdrawn from public view entirely.
    await content.updateTemplate('da-lat-3-ngay-lang-man', { visibility: 'private' });
    expectOne(
      await planner.validateIntegrity(),
      'trip',
      'is no longer approved (snapshot retained)',
    );
  });
});
