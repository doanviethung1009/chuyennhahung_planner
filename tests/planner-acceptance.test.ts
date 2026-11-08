import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createJsonPlannerStore } from '../src/server/planner/store';
import { makeOwner, makePlanner, makeSeededPlanner } from './planner-helpers';

/**
 * The scenario from the brief, start to finish:
 *
 *   Đà Lạt · 3 ngày 2 đêm · 2 người · ngân sách 5.000.000 VND · lãng mạn
 *
 * It runs against the **real** seeded content system, so the clone is taken
 * from the committed `da-lat-3-ngay-lang-man` template rather than a fixture,
 * and against a real JSON file, so "reload mất dữ liệu" would show up here.
 */

const TARGET_VND = 5_000_000;

let workdir: string;

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-acceptance-'));
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('Đà Lạt, 3 ngày 2 đêm, 2 người, 5 triệu', () => {
  it('plans the trip from scratch and keeps the budget honest throughout', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);

    const created = await planner.createTrip(userId, {
      source: 'blank',
      title: 'Đà Lạt lãng mạn 3 ngày 2 đêm',
      destinationSlug: 'da-lat',
      startDate: '2026-04-10',
      durationDays: 3,
      partySize: 2,
      travelStyle: 'romantic',
      pace: 'relaxed',
      budget: { targetTotalVnd: TARGET_VND, currency: 'VND' },
      note: 'Kỷ niệm cưới.',
    });

    // 3 ngày 2 đêm → three dated days, ending on the 12th.
    expect(created.days.map((day) => day.date)).toEqual([
      '2026-04-10',
      '2026-04-11',
      '2026-04-12',
    ]);
    expect(created.trip.travelStyle).toBe('romantic');
    expect(created.budget.targetTotalVnd).toBe(TARGET_VND);

    // Two nights of accommodation, quoted per person per night by the hotel.
    let version = created.trip.version;
    const stay = await planner.addActivity(
      userId,
      created.trip.id,
      {
        dayNumber: 1,
        title: 'Nhận phòng homestay',
        placeSlug: null,
        startTime: '14:00',
        durationMinutes: 30,
        estimatedCostVnd: 450_000,
        costScope: 'per_person',
        category: 'stay',
        note: 'Hai đêm, giá mỗi người mỗi đêm là 225.000.',
      },
      version,
    );
    version = stay.trip.version;

    const coffee = await planner.addActivity(
      userId,
      created.trip.id,
      {
        dayNumber: 2,
        title: 'Cà phê Mê Linh, ngồi cả buổi sáng',
        placeSlug: 'vuon-ca-phe-me-linh',
        startTime: '08:30',
        durationMinutes: 120,
        estimatedCostVnd: 250_000,
        costScope: 'group',
        note: null,
      },
      version,
    );
    version = coffee.trip.version;

    const dinner = await planner.addActivity(
      userId,
      created.trip.id,
      {
        dayNumber: 3,
        title: 'Ăn tối ở nhà hàng nhỏ ven hồ',
        placeSlug: null,
        startTime: '19:00',
        durationMinutes: 90,
        estimatedCostVnd: 600_000,
        costScope: 'group',
        category: 'food',
        note: null,
      },
      version,
    );
    version = dinner.trip.version;

    // 450.000 × 2 + 250.000 + 600.000 = 1.750.000
    expect(dinner.budget.estimatedTotalVnd).toBe(1_750_000);
    expect(dinner.budget.actualTotalVnd).toBe(0);
    expect(dinner.budget.projectedTotalVnd).toBe(1_750_000);
    expect(dinner.budget.overBudget).toBe(false);

    // The coffee is paid, and it came to more than planned.
    const coffeeId = dinner.days[1]!.activities[0]!.id;
    const paid = await planner.addExpense(
      userId,
      created.trip.id,
      {
        label: 'Cà phê Mê Linh',
        category: 'food',
        amountVnd: 310_000,
        costScope: 'group',
        dayNumber: null,
        activityId: coffeeId,
        paidOn: '2026-04-11',
        note: null,
      },
      version,
    );
    version = paid.trip.version;

    // Paid 310.000; the plan's 250.000 is settled, not added on top.
    expect(paid.budget.actualTotalVnd).toBe(310_000);
    expect(paid.budget.projectedTotalVnd).toBe(1_810_000);
    expect(paid.budget.remainingVnd).toBe(TARGET_VND - 310_000);
    expect(paid.budget.perPerson.projectedVnd).toBe(905_000);

    // The whole bus fare for both of them, on no particular day.
    const bus = await planner.addExpense(
      userId,
      created.trip.id,
      {
        label: 'Xe giường nằm Sài Gòn – Đà Lạt, hai chiều',
        category: 'transport',
        amountVnd: 1_200_000,
        costScope: 'group',
        dayNumber: null,
        activityId: null,
        paidOn: '2026-04-09',
        note: null,
      },
      version,
    );

    expect(bus.budget.actualTotalVnd).toBe(1_510_000);
    expect(bus.budget.unassignedActualVnd).toBe(1_200_000);
    expect(bus.budget.projectedTotalVnd).toBe(3_010_000);
    // Still inside 5.000.000.
    expect(bus.budget.overBudget).toBe(false);
    expect(bus.budget.varianceVnd).toBe(-1_990_000);
  });

  it('clones the approved Đà Lạt template into an independent trip', async () => {
    const { planner, content } = await makeSeededPlanner();
    const { userId } = await makeOwner(planner);

    const templateBefore = await content.getTemplate('da-lat-3-ngay-lang-man');

    const cloned = await planner.createTrip(userId, {
      source: 'template',
      templateSlug: 'da-lat-3-ngay-lang-man',
      startDate: '2026-04-10',
      partySize: 2,
      budget: { targetTotalVnd: TARGET_VND, currency: 'VND' },
      note: null,
    });

    // Shape and content came across: three days, eight activities.
    expect(cloned.trip.durationDays).toBe(3);
    expect(cloned.trip.destinationSlug).toBe('da-lat');
    expect(cloned.trip.travelStyle).toBe('romantic');
    expect(cloned.trip.title).toBe('Đà Lạt 3 ngày lãng mạn — hai điểm mỗi ngày');
    expect(cloned.days.flatMap((day) => day.activities)).toHaveLength(8);
    expect(cloned.days[0]!.activities[0]!.title).toBe(
      'Đi một vòng hồ Xuân Hương lúc sương chưa tan',
    );
    expect(cloned.days[0]!.activities[0]!.placeSlug).toBe('ho-xuan-huong');
    // A cafe place implies a food cost without anyone saying so.
    expect(cloned.days[1]!.activities[1]!.category).toBe('food');

    // Provenance is recorded, including the version it was taken from.
    expect(cloned.trip.sourceTemplate).toMatchObject({
      templateSlug: 'da-lat-3-ngay-lang-man',
      templateVersion: templateBefore.version,
      durationDays: 3,
    });

    // The estimate matches the template's own total, since every activity was
    // cloned as a whole-party cost.
    expect(cloned.budget.estimatedTotalVnd).toBe(templateBefore.estimatedTotalVnd);

    // Every row is the trip's own: no id is shared with the template.
    const templateActivityIds = new Set(
      templateBefore.days.flatMap((day) => day.activities.map((activity) => activity.id)),
    );
    for (const activity of cloned.days.flatMap((day) => day.activities)) {
      expect(templateActivityIds.has(activity.id)).toBe(false);
      expect(activity.tripId).toBe(cloned.trip.id);
    }
  });

  it('leaves the template untouched when the clone is edited', async () => {
    const { planner, content } = await makeSeededPlanner();
    const { userId } = await makeOwner(planner);
    const before = await content.getTemplate('da-lat-3-ngay-lang-man');

    const cloned = await planner.createTrip(userId, {
      source: 'template',
      templateSlug: 'da-lat-3-ngay-lang-man',
      title: 'Bản của tôi',
      startDate: null,
      partySize: 2,
      budget: { targetTotalVnd: TARGET_VND, currency: 'VND' },
      note: null,
    });

    // Rearrange the clone thoroughly: move an activity across days, delete one,
    // and rewrite the price of another.
    const firstId = cloned.days[0]!.activities[0]!.id;
    const moved = await planner.reorder(
      userId,
      cloned.trip.id,
      { op: 'move-activity', activityId: firstId, toDayNumber: 3, toIndex: 0 },
      cloned.trip.version,
    );
    const deleted = await planner.deleteActivity(
      userId,
      cloned.trip.id,
      moved.days[1]!.activities[0]!.id,
      moved.trip.version,
    );
    await planner.updateActivity(
      userId,
      cloned.trip.id,
      deleted.days[2]!.activities[0]!.id,
      { estimatedCostVnd: 999_000 },
      deleted.trip.version,
    );

    const after = await content.getTemplate('da-lat-3-ngay-lang-man');
    expect(after).toEqual(before);
    expect(after.version).toBe(before.version);
    expect(after.estimatedTotalVnd).toBe(before.estimatedTotalVnd);
  });

  it('survives a reload: a fresh repository over the same file sees everything', async () => {
    const storePath = join(workdir, 'planner.json');

    // Session one: plan the trip and spend some money.
    const first = await makeSeededPlanner(createJsonPlannerStore(storePath));
    const owner = await makeOwner(first.planner);
    const cloned = await first.planner.createTrip(owner.userId, {
      source: 'template',
      templateSlug: 'da-lat-3-ngay-lang-man',
      startDate: '2026-04-10',
      partySize: 2,
      budget: { targetTotalVnd: TARGET_VND, currency: 'VND' },
      note: 'Giữ lại để đi thật.',
    });
    const spent = await first.planner.addExpense(
      owner.userId,
      cloned.trip.id,
      {
        label: 'Homestay hai đêm',
        category: 'stay',
        amountVnd: 1_400_000,
        costScope: 'group',
        dayNumber: 1,
        activityId: null,
        paidOn: '2026-04-10',
        note: null,
      },
      cloned.trip.version,
    );

    // Session two: a brand-new repository, a brand-new store object, same file.
    const second = await makeSeededPlanner(createJsonPlannerStore(storePath));
    const restored = await second.planner.getTrip(owner.userId, cloned.trip.id);

    expect(restored.trip).toEqual(spent.trip);
    expect(restored.days.flatMap((day) => day.activities)).toHaveLength(8);
    expect(restored.expenses).toHaveLength(1);
    expect(restored.expenses[0]!.label).toBe('Homestay hai đêm');
    expect(restored.budget.actualTotalVnd).toBe(1_400_000);
    expect(restored.budget.estimatedTotalVnd).toBe(spent.budget.estimatedTotalVnd);

    // And the owner's token still resolves against the reloaded users.
    const identified = await second.planner.identify(
      new Request('https://example.test/api/planner', {
        headers: { authorization: `Bearer ${owner.token}` },
      }),
    );
    expect(identified.userId).toBe(owner.userId);
  });
});
