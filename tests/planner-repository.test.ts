import { describe, expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import {
  activityInput,
  daLatTripInput,
  expenseInput,
  fakeCatalog,
  makeOwner,
  makePlanner,
} from './planner-helpers';

/**
 * Domain-level tests for the Planner core. The API layer is covered separately
 * in `planner-api.test.ts`; everything here goes straight at the repository, so
 * a failure points at an invariant rather than at a status code.
 */

/** Asserts a rejection carries a specific machine code, not just any error. */
async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (!isContentError(error)) throw error;
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`expected the call to fail with "${code}", but it resolved`);
}

describe('trip creation', () => {
  it('generates one day per day of the trip, numbered and dated', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);

    const { trip, days } = await planner.createTrip(userId, daLatTripInput());

    expect(trip.durationDays).toBe(3);
    expect(trip.startDate).toBe('2026-04-10');
    // 3 ngày 2 đêm: the last day is the third, not the fourth.
    expect(trip.endDate).toBe('2026-04-12');
    expect(days.map((day) => day.dayNumber)).toEqual([1, 2, 3]);
    expect(days.map((day) => day.date)).toEqual([
      '2026-04-10',
      '2026-04-11',
      '2026-04-12',
    ]);
    expect(days.every((day) => day.activities.length === 0)).toBe(true);
    expect(trip.version).toBe(1);
  });

  it('leaves days undated when the trip has no start date yet', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);

    const { trip, days } = await planner.createTrip(
      userId,
      daLatTripInput({ startDate: null }),
    );

    expect(trip.endDate).toBeNull();
    expect(days.map((day) => day.date)).toEqual([null, null, null]);
  });

  it('refuses a destination that does not exist', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);

    await expectCode(
      planner.createTrip(userId, daLatTripInput({ destinationSlug: 'sao-hoa' })),
      'invalid_reference',
    );
  });

  it('refuses to create a trip for an owner that does not exist', async () => {
    const planner = makePlanner();
    await expectCode(planner.createTrip('usr_nobody', daLatTripInput()), 'not_found');
  });
});

describe('object-level authorization', () => {
  it('hides another traveller’s trip behind a 404, not a 403', async () => {
    const planner = makePlanner();
    const mine = await makeOwner(planner, 'hung-tran');
    const theirs = await makeOwner(planner, 'mai-nguyen');

    const { trip } = await planner.createTrip(mine.userId, daLatTripInput());

    // `not_found` rather than `unauthorized`: the API must not confirm that
    // this id exists to someone who may not see it.
    await expectCode(planner.getTrip(theirs.userId, trip.id), 'not_found');
    await expectCode(
      planner.updateTrip(theirs.userId, trip.id, { title: 'Chiếm quyền' }, trip.version),
      'not_found',
    );
    await expectCode(
      planner.addActivity(theirs.userId, trip.id, activityInput(), null),
      'not_found',
    );
    await expectCode(
      planner.archiveTrip(theirs.userId, trip.id, trip.version),
      'not_found',
    );

    // And the owner's trip is untouched by any of those attempts.
    const after = await planner.getTrip(mine.userId, trip.id);
    expect(after.trip.title).toBe('Đà Lạt 3 ngày 2 đêm');
    expect(after.trip.version).toBe(1);
  });

  it('lists only the caller’s own trips', async () => {
    const planner = makePlanner();
    const mine = await makeOwner(planner, 'hung-tran');
    const theirs = await makeOwner(planner, 'mai-nguyen');

    await planner.createTrip(mine.userId, daLatTripInput({ title: 'Của tôi' }));
    await planner.createTrip(theirs.userId, daLatTripInput({ title: 'Của người khác' }));

    expect((await planner.listTrips(mine.userId)).map((trip) => trip.title)).toEqual([
      'Của tôi',
    ]);
    expect((await planner.listTrips(theirs.userId)).map((trip) => trip.title)).toEqual([
      'Của người khác',
    ]);
  });
});

describe('activities', () => {
  it('appends in order and takes its title and category from a catalog place', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    await planner.addActivity(
      userId,
      trip.id,
      activityInput({ title: 'Ăn sáng', estimatedCostVnd: 90_000, category: 'food' }),
      null,
    );
    const view = await planner.addActivity(
      userId,
      trip.id,
      // No title and no category: both come from the place.
      activityInput({ placeSlug: 'vuon-ca-phe-me-linh', title: undefined, estimatedCostVnd: 250_000 }),
      null,
    );

    const day1 = view.days[0]!;
    expect(day1.activities.map((a) => [a.order, a.title])).toEqual([
      [0, 'Ăn sáng'],
      [1, 'Cà phê Mê Linh'],
    ]);
    // A cafe is a food cost, inferred rather than asked for.
    expect(day1.activities[1]!.category).toBe('food');
    expect(day1.activities[1]!.placeSlug).toBe('vuon-ca-phe-me-linh');
  });

  it('inserts at a requested index and keeps order contiguous', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    await planner.addActivity(userId, trip.id, activityInput({ title: 'A' }), null);
    await planner.addActivity(userId, trip.id, activityInput({ title: 'B' }), null);
    const view = await planner.addActivity(
      userId,
      trip.id,
      activityInput({ title: 'C', toIndex: 0 }),
      null,
    );

    expect(view.days[0]!.activities.map((a) => a.title)).toEqual(['C', 'A', 'B']);
    expect(view.days[0]!.activities.map((a) => a.order)).toEqual([0, 1, 2]);
  });

  it('rejects a self-made activity with no title and refuses an unknown place', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    await expectCode(
      planner.addActivity(
        userId,
        trip.id,
        activityInput({ placeSlug: 'khong-co-that' }),
        null,
      ),
      'invalid_reference',
    );
    await expectCode(
      planner.addActivity(userId, trip.id, activityInput({ dayNumber: 9 }), null),
      'not_found',
    );
  });

  it('refuses a catalog place from another destination, and leaves the trip untouched', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    const error = await planner
      .addActivity(userId, trip.id, activityInput({ placeSlug: 'doi-che-moc-chau' }), null)
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(error).toMatchObject({
      code: 'invalid_reference',
      status: 422,
      issues: [{ path: 'placeSlug' }],
    });

    const after = await planner.getTrip(userId, trip.id);
    expect(after.trip.version).toBe(trip.version);
    expect(after.days[0]!.activities).toHaveLength(0);
  });

  it('accepts a catalog place from the trip destination', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    const view = await planner.addActivity(
      userId,
      trip.id,
      activityInput({ placeSlug: 'ho-xuan-huong', title: undefined }),
      null,
    );
    expect(view.days[0]!.activities[0]!.placeSlug).toBe('ho-xuan-huong');
  });

  it('keeps an expense when the activity it paid for is deleted', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    const added = await planner.addActivity(
      userId,
      trip.id,
      activityInput({ estimatedCostVnd: 250_000 }),
      null,
    );
    const activityId = added.days[0]!.activities[0]!.id;
    const withExpense = await planner.addExpense(
      userId,
      trip.id,
      expenseInput({ amountVnd: 310_000, activityId }),
      null,
    );

    const after = await planner.deleteActivity(
      userId,
      trip.id,
      activityId,
      withExpense.trip.version,
    );

    // The plan row is gone; the record of the money is not.
    expect(after.days[0]!.activities).toHaveLength(0);
    expect(after.expenses).toHaveLength(1);
    expect(after.expenses[0]!.activityId).toBeNull();
    expect(after.budget.actualTotalVnd).toBe(310_000);
  });
});

describe('reordering and moving between days', () => {
  it('reorders within a day by permutation', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    for (const title of ['A', 'B', 'C']) {
      await planner.addActivity(userId, trip.id, activityInput({ title }), null);
    }
    const current = await planner.getTrip(userId, trip.id);
    const ids = current.days[0]!.activities.map((a) => a.id);

    const view = await planner.reorder(
      userId,
      trip.id,
      { op: 'reorder-day', dayNumber: 1, activityIds: [ids[2]!, ids[0]!, ids[1]!] },
      current.trip.version,
    );

    expect(view.days[0]!.activities.map((a) => a.title)).toEqual(['C', 'A', 'B']);
    expect(view.days[0]!.activities.map((a) => a.order)).toEqual([0, 1, 2]);
  });

  it('refuses a reorder that is not a permutation of that day', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    const added = await planner.addActivity(userId, trip.id, activityInput(), null);
    const id = added.days[0]!.activities[0]!.id;

    await expectCode(
      planner.reorder(
        userId,
        trip.id,
        { op: 'reorder-day', dayNumber: 1, activityIds: [id, id] },
        added.trip.version,
      ),
      'invalid_state',
    );
    await expectCode(
      planner.reorder(
        userId,
        trip.id,
        { op: 'reorder-day', dayNumber: 1, activityIds: ['act_nope'] },
        added.trip.version,
      ),
      'invalid_state',
    );
  });

  it('moves an activity to another day, renumbering both', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    await planner.addActivity(userId, trip.id, activityInput({ title: 'A' }), null);
    await planner.addActivity(userId, trip.id, activityInput({ title: 'B' }), null);
    await planner.addActivity(
      userId,
      trip.id,
      activityInput({ title: 'Z', dayNumber: 2 }),
      null,
    );
    const before = await planner.getTrip(userId, trip.id);
    const idOfA = before.days[0]!.activities[0]!.id;

    const view = await planner.reorder(
      userId,
      trip.id,
      { op: 'move-activity', activityId: idOfA, toDayNumber: 2, toIndex: 0 },
      before.trip.version,
    );

    expect(view.days[0]!.activities.map((a) => [a.title, a.order])).toEqual([['B', 0]]);
    expect(view.days[1]!.activities.map((a) => [a.title, a.order])).toEqual([
      ['A', 0],
      ['Z', 1],
    ]);
  });

  it('carries a linked expense with the activity it follows', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    const added = await planner.addActivity(userId, trip.id, activityInput(), null);
    const activityId = added.days[0]!.activities[0]!.id;
    const withExpense = await planner.addExpense(
      userId,
      trip.id,
      expenseInput({ amountVnd: 150_000, activityId }),
      null,
    );
    expect(withExpense.budget.byDay[0]!.actualVnd).toBe(150_000);

    const moved = await planner.reorder(
      userId,
      trip.id,
      { op: 'move-activity', activityId, toDayNumber: 3, toIndex: 0 },
      withExpense.trip.version,
    );

    // The money moved with the activity, so day totals stay truthful.
    expect(moved.budget.byDay[0]!.actualVnd).toBe(0);
    expect(moved.budget.byDay[2]!.actualVnd).toBe(150_000);
  });
});

describe('optimistic concurrency', () => {
  it('bumps the version on every mutation anywhere in the trip', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const created = await planner.createTrip(userId, daLatTripInput());
    expect(created.trip.version).toBe(1);

    const withActivity = await planner.addActivity(userId, created.trip.id, activityInput(), null);
    expect(withActivity.trip.version).toBe(2);

    const withExpense = await planner.addExpense(userId, created.trip.id, expenseInput(), null);
    expect(withExpense.trip.version).toBe(3);

    const titled = await planner.updateDay(
      userId,
      created.trip.id,
      1,
      { title: 'Ngày nhẹ nhàng' },
      withExpense.trip.version,
    );
    expect(titled.trip.version).toBe(4);
  });

  it('refuses a mutation of existing state with no expected version', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    await expectCode(
      planner.updateTrip(userId, trip.id, { title: 'Không có If-Match' }, null),
      'precondition_required',
    );
  });

  it('refuses the slower of two concurrent edits instead of losing one', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    // Two tabs both read version 1.
    const readA = trip.version;
    const readB = trip.version;

    const first = await planner.updateTrip(userId, trip.id, { partySize: 4 }, readA);
    expect(first.trip.partySize).toBe(4);

    // The second tab writes against a version that has moved on.
    await expectCode(
      planner.updateTrip(userId, trip.id, { partySize: 6 }, readB),
      'version_conflict',
    );

    // The first write stands — it was not silently overwritten.
    expect((await planner.getTrip(userId, trip.id)).trip.partySize).toBe(4);
  });

  it('accepts an append with no expected version but still checks a stale one', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    await planner.addActivity(userId, trip.id, activityInput(), null);
    await expectCode(
      planner.addActivity(userId, trip.id, activityInput(), trip.version),
      'version_conflict',
    );
  });
});

describe('save and restore', () => {
  it('archives without destroying anything, then restores it intact', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    const withActivity = await planner.addActivity(
      userId,
      trip.id,
      activityInput({ estimatedCostVnd: 250_000 }),
      null,
    );

    const archived = await planner.archiveTrip(userId, trip.id, withActivity.trip.version);
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBe('2026-03-01T08:00:00.000Z');

    // Out of the default list, still readable, not editable.
    expect(await planner.listTrips(userId)).toEqual([]);
    expect((await planner.listTrips(userId, { status: 'archived' })).map((t) => t.id)).toEqual([
      trip.id,
    ]);
    await expectCode(
      planner.addActivity(userId, trip.id, activityInput(), null),
      'invalid_state',
    );

    const restored = await planner.restoreTrip(userId, trip.id, archived.version);
    expect(restored.trip.status).toBe('active');
    expect(restored.trip.archivedAt).toBeNull();
    expect(restored.days[0]!.activities).toHaveLength(1);
    expect(restored.budget.estimatedTotalVnd).toBe(250_000);
  });

  it('requires an archive before a permanent delete, then removes every row', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    const withActivity = await planner.addActivity(userId, trip.id, activityInput(), null);

    await expectCode(
      planner.purgeTrip(userId, trip.id, withActivity.trip.version),
      'invalid_state',
    );

    const archived = await planner.archiveTrip(userId, trip.id, withActivity.trip.version);
    await planner.purgeTrip(userId, trip.id, archived.version);

    await expectCode(planner.getTrip(userId, trip.id), 'not_found');
    expect(await planner.listTrips(userId, { status: 'archived' })).toEqual([]);
  });
});

describe('changing the shape of a trip', () => {
  it('adds days when the trip gets longer and re-dates them all', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    const view = await planner.updateTrip(
      userId,
      trip.id,
      { durationDays: 5, startDate: '2026-05-01' },
      trip.version,
    );

    expect(view.days.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(view.days.map((day) => day.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
    ]);
    expect(view.trip.endDate).toBe('2026-05-05');
  });

  it('refuses to shorten a trip over a day that still holds something', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    const withActivity = await planner.addActivity(
      userId,
      trip.id,
      activityInput({ dayNumber: 3 }),
      null,
    );

    await expectCode(
      planner.updateTrip(userId, trip.id, { durationDays: 2 }, withActivity.trip.version),
      'invalid_state',
    );

    // Still three days, nothing lost.
    expect((await planner.getTrip(userId, trip.id)).days).toHaveLength(3);
  });

  it('shortens freely when the removed days are empty', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());

    const view = await planner.updateTrip(userId, trip.id, { durationDays: 2 }, trip.version);
    expect(view.days.map((day) => day.dayNumber)).toEqual([1, 2]);
    expect(view.trip.endDate).toBe('2026-04-11');
  });
});

describe('expenses', () => {
  it('takes its day from the activity it is linked to', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    const added = await planner.addActivity(
      userId,
      trip.id,
      activityInput({ dayNumber: 2 }),
      null,
    );
    const activityId = added.days[1]!.activities[0]!.id;

    const view = await planner.addExpense(
      userId,
      trip.id,
      expenseInput({ activityId }),
      null,
    );

    expect(view.expenses[0]!.dayId).toBe(view.days[1]!.id);
  });

  it('refuses a day that contradicts the linked activity, and an unknown reference', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    const added = await planner.addActivity(userId, trip.id, activityInput(), null);
    const activityId = added.days[0]!.activities[0]!.id;

    await expectCode(
      planner.addExpense(userId, trip.id, expenseInput({ activityId, dayNumber: 2 }), null),
      'invalid_reference',
    );
    await expectCode(
      planner.addExpense(userId, trip.id, expenseInput({ activityId: 'act_nope' }), null),
      'invalid_reference',
    );
    await expectCode(
      planner.addExpense(userId, trip.id, expenseInput({ dayNumber: 9 }), null),
      'invalid_reference',
    );
  });

  it('cannot attach an expense to an activity in someone else’s trip', async () => {
    const planner = makePlanner();
    const mine = await makeOwner(planner, 'hung-tran');
    const theirs = await makeOwner(planner, 'mai-nguyen');

    const ours = await planner.createTrip(mine.userId, daLatTripInput());
    const withActivity = await planner.addActivity(
      mine.userId,
      ours.trip.id,
      activityInput(),
      null,
    );
    const foreignActivityId = withActivity.days[0]!.activities[0]!.id;

    const theirTrip = await planner.createTrip(theirs.userId, daLatTripInput());
    await expectCode(
      planner.addExpense(
        theirs.userId,
        theirTrip.trip.id,
        expenseInput({ activityId: foreignActivityId }),
        null,
      ),
      'invalid_reference',
    );
  });
});

describe('planner users', () => {
  it('never exposes the token digest and issues the token exactly once', async () => {
    const planner = makePlanner();
    const issued = await planner.createUser({ handle: 'hung-tran', displayName: 'Hưng Trần' });

    expect(issued.accessToken.length).toBeGreaterThanOrEqual(32);
    expect(issued.user).not.toHaveProperty('tokenHash');
    expect(JSON.stringify(await planner.listUsers())).not.toContain('tokenHash');
  });

  it('rejects a duplicate handle', async () => {
    const planner = makePlanner();
    await planner.createUser({ handle: 'hung-tran', displayName: 'Hưng Trần' });
    await expectCode(
      planner.createUser({ handle: 'hung-tran', displayName: 'Ai đó' }),
      'slug_conflict',
    );
  });

  it('invalidates the old token on rotation', async () => {
    const planner = makePlanner();
    const first = await planner.createUser({ handle: 'hung-tran', displayName: 'Hưng Trần' });
    const second = await planner.rotateUserToken(first.user.id);

    const authed = (token: string) =>
      new Request('https://example.test/api/planner', {
        headers: { authorization: `Bearer ${token}` },
      });

    expect((await planner.identify(authed(second.accessToken))).userId).toBe(first.user.id);
    await expectCode(planner.identify(authed(first.accessToken)), 'unauthorized');
  });

  it('refuses to delete a traveller who still owns trips', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.createTrip(userId, daLatTripInput());

    await expectCode(planner.deleteUser(userId), 'invalid_state');

    const other = await planner.createUser({ handle: 'mai-nguyen', displayName: 'Mai' });
    await planner.deleteUser(other.user.id);
    expect((await planner.listUsers()).map((user) => user.handle)).toEqual(['hung-tran']);
  });

  it('rejects an unknown or malformed bearer token', async () => {
    const planner = makePlanner();
    await makeOwner(planner);
    const url = 'https://example.test/api/planner';

    await expectCode(planner.identify(new Request(url)), 'unauthorized');
    await expectCode(
      planner.identify(new Request(url, { headers: { authorization: 'Bearer short' } })),
      'unauthorized',
    );
    await expectCode(
      planner.identify(
        new Request(url, { headers: { authorization: 'Basic abcdefghijklmnopqrstuvwxyz123456' } }),
      ),
      'unauthorized',
    );
  });
});

describe('catalog isolation', () => {
  it('refuses to clone a template that is not approved', async () => {
    // `getApprovedTemplate` returns null for a draft, exactly as the content
    // repository's `getPublicTemplate` 404s on one.
    const planner = makePlanner({ catalog: fakeCatalog() });
    const { userId } = await makeOwner(planner);

    await expectCode(
      planner.createTrip(userId, {
        source: 'template',
        templateSlug: 'da-lat-3-ngay-lang-man',
        startDate: null,
        partySize: 2,
        budget: { targetTotalVnd: 5_000_000, currency: 'VND' },
        note: null,
      }),
      'invalid_reference',
    );
  });
});
