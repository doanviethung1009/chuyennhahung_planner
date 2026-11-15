import type { PlannerRepository } from '../src/server/planner/repository';
import type { PlannerData } from '../src/server/planner/store';
import {
  activityInput,
  daLatTripInput,
  expenseInput,
  makeOwner,
} from './planner-helpers';

/**
 * One realistic Planner history, driven through the repository so every row is
 * exactly what production code would write: an operator-provisioned user with
 * an email and temporary password, a session, a trip with activities moved and
 * reordered, an expense that follows an activity, a duplicate and an archived
 * trip. Used offline against the memory store and, when `TEST_DATABASE_URL`
 * is set, against Postgres — the two must end up equal.
 */
export async function runScenario(planner: PlannerRepository): Promise<{
  userId: string;
  tripId: string;
  activityId: string;
  copyId: string;
}> {
  const { userId, token } = await makeOwner(planner);
  await planner.signIn(token);
  await planner.createUser({
    handle: 'lan-pham',
    displayName: 'Lan Phạm',
    email: 'lan@example.com',
  });

  const attempt = {
    nonce: 'n'.repeat(24),
    codeVerifier: 'v'.repeat(48),
    returnTo: '/my-trips',
    locale: 'vi' as const,
  };
  await planner.beginGoogleSignIn({ ...attempt, stateHash: 'a'.repeat(64) });
  await planner.beginGoogleSignIn({ ...attempt, stateHash: 'b'.repeat(64), linkUserId: userId });

  const created = await planner.createTrip(userId, daLatTripInput({ note: 'Kỷ niệm cưới.' }));
  const tripId = created.trip.id;

  let view = await planner.addActivity(
    userId,
    tripId,
    activityInput({ title: 'Cà phê sáng', startTime: '07:30', estimatedCostVnd: 90_000 }),
    created.trip.version,
  );
  view = await planner.addActivity(
    userId,
    tripId,
    activityInput({ title: 'Hồ Xuân Hương', startTime: null, placeSlug: 'ho-xuan-huong' }),
    view.trip.version,
  );
  view = await planner.addActivity(
    userId,
    tripId,
    activityInput({ title: 'Chợ đêm', dayNumber: 2, estimatedCostVnd: 150_000 }),
    view.trip.version,
  );

  const dayOne = view.days[0]!.activities.map((activity) => activity.id);
  view = await planner.reorder(
    userId,
    tripId,
    { op: 'reorder-day', dayNumber: 1, activityIds: [...dayOne].reverse() },
    view.trip.version,
  );
  const activityId = view.days[0]!.activities[0]!.id;
  view = await planner.addExpense(
    userId,
    tripId,
    expenseInput({ activityId, amountVnd: 95_000, paidOn: '2026-04-10' }),
    view.trip.version,
  );
  view = await planner.addExpense(
    userId,
    tripId,
    expenseInput({ label: 'Vé máy bay', category: 'transport', amountVnd: 1_800_000 }),
    view.trip.version,
  );
  const copy = await planner.duplicateTrip(userId, tripId, { title: 'Đà Lạt bản sao' });
  await planner.setVisibility(userId, tripId, 'unlisted');
  const second = await planner.createTrip(userId, daLatTripInput({ title: 'Mộc Châu cuối tuần' }));
  await planner.archiveTrip(userId, second.trip.id, second.trip.version);

  // ADR 0014 PR 2: one pending Planner review and one published guest review.
  const reviewBody = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
  await planner.upsertPlannerReview(userId, 'ho-xuan-huong', {
    rating: 5,
    body: reviewBody,
    lang: 'vi',
    visitedOn: '2026-02-20',
    authorDisplay: 'name',
  });
  await planner.createGuestReview(
    { placeSlug: 'ho-xuan-huong', rating: 4, body: reviewBody, lang: 'vi', visitedOn: '2026-02-21', authorName: null },
    '198.51.100.4',
  );

  return { userId, tripId, activityId, copyId: copy.trip.id };
}

/** Everything that is deterministic: random token digests are removed. */
export function stable(data: PlannerData) {
  return {
    users: data.users.map(({ tokenHash: _t, passwordHash: _p, ...rest }) => rest),
    trips: data.trips.map(({ shareToken: _s, ...rest }) => rest),
    tripDays: data.tripDays,
    tripActivities: data.tripActivities,
    tripExpenses: data.tripExpenses,
  };
}
