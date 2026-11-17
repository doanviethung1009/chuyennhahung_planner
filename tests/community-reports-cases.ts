import { expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import type { PlannerRepository } from '../src/server/planner/repository';
import type { PlannerStore } from '../src/server/planner/store';
import { activityInput, daLatTripInput } from './planner-helpers';

/**
 * Batch 10.5 reports, written once and run against every store: the memory store
 * in `community-reports.test.ts`, PostgreSQL in the integration file (skipped
 * without `TEST_DATABASE_URL`).
 */
export interface ReportsCtx {
  planner: PlannerRepository;
  store: PlannerStore;
}

const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (!isContentError(error)) throw error;
    return error.code;
  }
  throw new Error('expected a failure, but it resolved');
}

export function registerReportCases(setup: () => Promise<ReportsCtx>): void {
  let n = 0;
  async function world() {
    const ctx = await setup();
    const { planner } = ctx;
    n += 1;
    const owner = (await planner.createUser({ handle: `rep-owner-${n}`, displayName: 'Chủ chuyến', role: 'member' })).user.id;
    const view = await planner.createTrip(owner, daLatTripInput({ title: 'Đà Lạt ba ngày' }));
    await planner.addActivity(owner, view.trip.id, activityInput(), null);
    await planner.setVisibility(owner, view.trip.id, 'public');
    await planner.requestListing(owner, view.trip.id, 'name');
    await planner.decideListing(view.trip.id, 'approve', 'staff-1', null);
    const token = (await planner.getTrip(owner, view.trip.id)).trip.shareToken!;
    await planner.createGuestReview({ placeSlug: 'ho-xuan-huong', rating: 5, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorName: null }, '203.0.113.5');
    const reviewId = (await planner.listApprovedReviews()).items[0]!.id;
    const member = (await planner.createUser({ handle: `rep-member-${n}`, displayName: 'Người đọc', role: 'member' })).user.id;
    return { ...ctx, owner, tripId: view.trip.id, token, reviewId, member };
  }

  it('files a report by a guest and by a member, for a trip and for a review', async () => {
    const w = await world();
    await w.planner.createReport({ targetKind: 'trip', shareToken: w.token, reason: 'spam', note: 'quảng cáo' }, { userId: null, clientKey: '198.51.100.1' });
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'harassment' }, { userId: w.member, clientKey: '198.51.100.2' });
    const items = await w.planner.listReports('open');
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.targetKind === 'trip')).toMatchObject({ targetId: w.tripId, reason: 'spam', note: 'quảng cáo', signedIn: false, targetLive: true, targetLabel: 'Đà Lạt ba ngày' });
    expect(items.find((i) => i.targetKind === 'review')).toMatchObject({ targetId: w.reviewId, signedIn: true });
    // Never the token, the reporter or the client key.
    const json = JSON.stringify(items);
    expect(json).not.toContain(w.token);
    expect(json).not.toMatch(/clientKey|reporterId|198\.51\.100/);
    const rows = (await w.store.read()).reports;
    expect(rows.find((r) => r.reporterId === null)?.clientKey).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(rows)).not.toContain(w.token);
    expect(JSON.stringify(rows)).not.toContain('198.51.100.1');
  });

  it('answers an unknown or non-public target with the same not_found', async () => {
    const w = await world();
    const who = { userId: null, clientKey: 'k' };
    const unknownToken = 'A'.repeat(43);
    expect(await codeOf(w.planner.createReport({ targetKind: 'trip', shareToken: unknownToken, reason: 'spam' }, who))).toBe('not_found');
    expect(await codeOf(w.planner.createReport({ targetKind: 'review', targetId: 'rev_nope', reason: 'spam' }, who))).toBe('not_found');
    // An unlisted (not public) trip and a removed review look the same.
    await w.planner.setVisibility(w.owner, w.tripId, 'unlisted');
    expect(await codeOf(w.planner.createReport({ targetKind: 'trip', shareToken: w.token, reason: 'spam' }, who))).toBe('not_found');
    await w.planner.decideReview(w.reviewId, 'remove', 'staff-1', 'vi phạm');
    expect(await codeOf(w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'spam' }, who))).toBe('not_found');
    expect((await w.store.read()).reports).toEqual([]);
  });

  it('ignores a duplicate open report by the same reporter, but not another reporter', async () => {
    const w = await world();
    const guest = { userId: null, clientKey: '198.51.100.9' };
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'spam' }, guest);
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'other' }, guest);
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'spam' }, { userId: w.member, clientKey: 'x' });
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'spam' }, { userId: w.member, clientKey: 'y' });
    expect((await w.store.read()).reports).toHaveLength(2);
    // Once closed, the same reporter may report again.
    const first = (await w.planner.listReports('open'))[0]!;
    await w.planner.resolveReport(first.id, { outcome: 'dismissed', reason: 'không vi phạm' }, 'staff-1');
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'spam' }, first.signedIn ? { userId: w.member, clientKey: 'z' } : guest);
    expect((await w.store.read()).reports).toHaveLength(3);
  });

  it('resolves once: one event, idempotent for the same outcome, refuses the other', async () => {
    const w = await world();
    await w.planner.createReport({ targetKind: 'trip', shareToken: w.token, reason: 'misleading', note: 'sai giá' }, { userId: null, clientKey: 'k' });
    const [item] = await w.planner.listReports();
    expect(await w.planner.resolveReport(item!.id, { outcome: 'actioned', reason: 'đã xem, sẽ gỡ' }, 'staff-1')).toBe('actioned');
    expect(await w.planner.resolveReport(item!.id, { outcome: 'actioned', reason: 'lần hai' }, 'staff-2')).toBe('actioned');
    expect(await codeOf(w.planner.resolveReport(item!.id, { outcome: 'dismissed', reason: 'đổi ý' }, 'staff-1'))).toBe('invalid_state');
    expect(await codeOf(w.planner.resolveReport('rpt_nope', { outcome: 'dismissed', reason: 'không có' }, 'staff-1'))).toBe('not_found');
    const events = (await w.store.read()).auditEvents.filter((e) => e.action.startsWith('report_'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ targetKind: 'trip', targetId: w.tripId, action: 'report_actioned', actorId: 'staff-1', fromStatus: 'open', toStatus: 'actioned', reason: 'đã xem, sẽ gỡ' });
    const [closed] = await w.planner.listReports('actioned');
    expect(closed).toMatchObject({ handledBy: 'staff-1', handlerReason: 'đã xem, sẽ gỡ' });
    expect(await w.planner.listReports('open')).toEqual([]);
    // `actioned` marks the report only: the trip is still public.
    expect(await w.planner.listCommunityTrips()).toHaveLength(1);
  });

  it('shows a report of a removed review as no longer actionable', async () => {
    const w = await world();
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'personal_data' }, { userId: null, clientKey: 'k' });
    expect((await w.planner.listReports())[0]?.targetLive).toBe(true);
    await w.planner.decideReview(w.reviewId, 'remove', 'staff-1', 'lộ số điện thoại');
    expect((await w.planner.listReports())[0]).toMatchObject({ targetLive: false, status: 'open' });
  });

  it('drops a member\'s reports with the account', async () => {
    const w = await world();
    await w.planner.createReport({ targetKind: 'review', targetId: w.reviewId, reason: 'spam' }, { userId: w.member, clientKey: 'k' });
    await w.planner.deleteUser(w.member);
    expect((await w.store.read()).reports).toEqual([]);
  });
}
