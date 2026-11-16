import { expect, it, vi } from 'vitest';
import type { PlannerRepository } from '../src/server/planner/repository';
import type { PlannerStore } from '../src/server/planner/store';
import { activityInput, daLatTripInput, makeOwner } from './planner-helpers';

/**
 * ADR 0019 §2 audit events, written once and run against every store: the
 * memory store in `moderation-events.test.ts` and PostgreSQL in the integration
 * file (skipped without `TEST_DATABASE_URL`).
 */
export interface EventCtx {
  planner: PlannerRepository;
  store: PlannerStore;
}

const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
const review = { rating: 5, body: BODY, lang: 'vi' as const, visitedOn: '2026-02-20', authorDisplay: 'name' as const };

export function registerEventCases(setup: () => Promise<EventCtx>): void {
  const eventsOf = async (ctx: EventCtx) => (await ctx.store.read()).auditEvents;
  const strip = (events: Awaited<ReturnType<typeof eventsOf>>) =>
    events.map((e) => ({ targetKind: e.targetKind, action: e.action, from: e.fromStatus, to: e.toStatus, actor: e.actorId, kind: e.actorKind, reason: e.reason }));

  async function publicTrip(ctx: EventCtx) {
    const { userId } = await makeOwner(ctx.planner);
    const view = await ctx.planner.createTrip(userId, daLatTripInput({ title: 'Đà Lạt ba ngày' }));
    await ctx.planner.addActivity(userId, view.trip.id, activityInput(), null);
    await ctx.planner.setVisibility(userId, view.trip.id, 'public');
    return { userId, tripId: view.trip.id };
  }

  /** Runs `action` with the store throwing after the callback: nothing may persist. */
  async function rollsBack(ctx: EventCtx, action: () => Promise<unknown>) {
    const before = JSON.stringify(await ctx.store.read());
    const original = ctx.store.transact.bind(ctx.store);
    const spy = vi.spyOn(ctx.store, 'transact').mockImplementation((fn) =>
      original(async (data) => {
        await fn(data);
        throw new Error('forced');
      }),
    );
    await expect(action()).rejects.toThrow('forced');
    spy.mockRestore();
    expect(JSON.stringify(await ctx.store.read())).toBe(before);
  }

  it('trip: request, withdraw, approve, reject, remove each write exactly one event', async () => {
    const ctx = await setup();
    const { userId, tripId } = await publicTrip(ctx);
    await ctx.planner.requestListing(userId, tripId, 'name');
    await ctx.planner.decideListing(tripId, 'approve', 'staff-1', null);
    await ctx.planner.decideListing(tripId, 'remove', 'staff-1', 'sai sự thật');
    await ctx.planner.requestListing(userId, tripId, 'name');
    await ctx.planner.decideListing(tripId, 'reject', 'service', 'chưa phù hợp');
    await ctx.planner.requestListing(userId, tripId, 'name');
    await ctx.planner.withdrawListing(userId, tripId);
    const rows = strip(await eventsOf(ctx));
    expect(rows.map((r) => r.action)).toEqual(['request', 'approve', 'remove', 'request', 'reject', 'request', 'withdraw']);
    expect(rows[0]).toMatchObject({ targetKind: 'trip', from: 'draft', to: 'pending', actor: userId, kind: 'user' });
    expect(rows[1]).toMatchObject({ from: 'pending', actor: 'staff-1', kind: 'user', reason: null });
    expect(rows[2]).toMatchObject({ reason: 'sai sự thật' });
    expect(rows[4]).toMatchObject({ actor: 'service', kind: 'service', reason: 'chưa phù hợp' });
    expect(rows[6]).toMatchObject({ to: 'draft', actor: userId });
    expect((await ctx.planner.listEvents(tripId)).length).toBe(7);
  });

  it('failures and idempotent no-ops write nothing', async () => {
    const ctx = await setup();
    const { userId, tripId } = await publicTrip(ctx);
    await ctx.planner.withdrawListing(userId, tripId); // no listing: no-op
    await expect(ctx.planner.decideListing(tripId, 'approve', 'staff', null)).rejects.toThrow(); // no listing
    await ctx.planner.requestListing(userId, tripId, 'name');
    await expect(ctx.planner.decideListing(tripId, 'remove', 'staff', 'x')).rejects.toThrow(); // still pending
    expect((await eventsOf(ctx)).map((e) => e.action)).toEqual(['request']);
    await ctx.planner.setVisibility(userId, tripId, 'public'); // stays public, listing kept
    await ctx.planner.revokeShare(userId, tripId);
    await ctx.planner.revokeShare(userId, tripId); // listing already gone: no second event
    expect((await eventsOf(ctx)).map((e) => e.action)).toEqual(['request', 'withdraw']);
  });

  it('an edit re-queues an approved listing; leaving public or archiving ends it', async () => {
    const ctx = await setup();
    const { userId, tripId } = await publicTrip(ctx);
    await ctx.planner.requestListing(userId, tripId, 'name');
    await ctx.planner.decideListing(tripId, 'approve', 'staff-1', null);
    const view = await ctx.planner.getTrip(userId, tripId);
    await ctx.planner.addActivity(userId, tripId, activityInput({ title: 'Cà phê mới' }), view.trip.version);
    let rows = strip(await eventsOf(ctx));
    expect(rows.at(-1)).toMatchObject({ action: 'requeue', from: 'published', to: 'pending', actor: userId, kind: 'user' });

    await ctx.planner.setVisibility(userId, tripId, 'unlisted');
    rows = strip(await eventsOf(ctx));
    expect(rows.at(-1)).toMatchObject({ action: 'withdraw', from: 'pending', to: 'draft', actor: 'system', kind: 'service', reason: 'implicit_end' });

    await ctx.planner.setVisibility(userId, tripId, 'public');
    await ctx.planner.requestListing(userId, tripId, 'name');
    const v2 = await ctx.planner.getTrip(userId, tripId);
    await ctx.planner.archiveTrip(userId, tripId, v2.trip.version);
    expect(strip(await eventsOf(ctx)).at(-1)).toMatchObject({ action: 'withdraw', reason: 'implicit_end' });
  });

  it('review: approve, reject, hold, remove and the author republish', async () => {
    const ctx = await setup();
    const { userId } = await makeOwner(ctx.planner);
    await ctx.planner.upsertPlannerReview(userId, 'ho-xuan-huong', review);
    await ctx.planner.createGuestReview({ placeSlug: 'ho-xuan-huong', rating: 3, body: BODY, lang: 'vi', visitedOn: '2026-02-21', authorName: null }, 'evt-guest');
    expect(await eventsOf(ctx)).toEqual([]); // creating a live review is not a moderation action
    const queue = await ctx.planner.listReviewQueue();
    const mine = queue.find((q) => q.source === 'planner')!;
    const guest = queue.find((q) => q.source === 'homepage')!;
    await ctx.planner.decideReview(mine.id, 'hold', 'staff-1', 'Bạn đi hồi nào?');
    await ctx.planner.upsertPlannerReview(userId, 'ho-xuan-huong', { ...review, rating: 4 }); // republish
    await ctx.planner.upsertPlannerReview(userId, 'ho-xuan-huong', { ...review, rating: 3 }); // plain edit: no event
    await ctx.planner.decideReview(mine.id, 'remove', 'staff-1', 'vi phạm');
    await ctx.planner.decideReview(guest.id, 'remove', 'staff-2', null);
    await expect(ctx.planner.decideReview(guest.id, 'remove', 'staff-2', null)).rejects.toThrow();
    const rows = strip(await eventsOf(ctx));
    expect(rows.map((r) => [r.action, r.from, r.to, r.actor])).toEqual([
      ['hold', 'approved', 'held', 'staff-1'],
      ['republish', 'held', 'approved', userId],
      ['remove', 'approved', 'removed', 'staff-1'],
      ['remove', 'approved', 'removed', 'staff-2'],
    ]);
    expect(rows[0]).toMatchObject({ targetKind: 'review', reason: 'Bạn đi hồi nào?' });
  });

  it('restriction: apply, lift (once), and lift on account delete; a guest key never appears', async () => {
    const ctx = await setup();
    const { userId } = await makeOwner(ctx.planner);
    await ctx.planner.upsertPlannerReview(userId, 'ho-xuan-huong', review);
    await ctx.planner.createGuestReview({ placeSlug: 'ho-xuan-huong', rating: 3, body: BODY, lang: 'vi', visitedOn: '2026-02-21', authorName: null }, 'evt-guest-key-xyz');
    const queue = await ctx.planner.listReviewQueue();
    const mine = queue.find((q) => q.source === 'planner')!;
    const guest = queue.find((q) => q.source === 'homepage')!;
    const g = await ctx.planner.createRestriction({ reviewId: guest.id, scope: 'place', reason: 'spam lặp lại' }, 'staff-1');
    await ctx.planner.liftRestriction(g.id, 'staff-1');
    await ctx.planner.liftRestriction(g.id, 'staff-1'); // no-op
    await expect(ctx.planner.createRestriction({ reviewId: guest.id, scope: 'all', reason: 'spam lặp lại' }, 'staff-1')).rejects.toThrow();
    await ctx.planner.createRestriction({ reviewId: mine.id, scope: 'all', reason: 'quấy rối' }, 'service');
    await ctx.planner.deleteUser(userId);
    const data = await ctx.store.read();
    const rows = strip(data.auditEvents);
    expect(rows.map((r) => [r.action, r.from, r.to, r.actor, r.kind])).toEqual([
      ['restrict', null, 'active', 'staff-1', 'user'],
      ['lift', 'active', 'lifted', 'staff-1', 'user'],
      ['restrict', null, 'active', 'service', 'service'],
      ['lift', 'active', 'lifted', 'account deleted', 'service'],
    ]);
    expect(data.auditEvents[0]!.targetId).toBe(g.id); // guest target = restriction id
    expect(data.auditEvents[2]!.targetId).toBe(userId);
    expect(JSON.stringify(data.auditEvents)).not.toContain('evt-guest-key');
    const key = data.communityReviews.find((r) => r.guestKey)!.guestKey!;
    expect(JSON.stringify(data.auditEvents)).not.toContain(key);
  });

  it('an event commits or rolls back with its change', async () => {
    const ctx = await setup();
    const { userId, tripId } = await publicTrip(ctx);
    await ctx.planner.requestListing(userId, tripId, 'name');
    await rollsBack(ctx, () => ctx.planner.decideListing(tripId, 'approve', 'staff', null));
    expect((await eventsOf(ctx)).map((e) => e.action)).toEqual(['request']);
    expect((await ctx.store.read()).trips.find((t) => t.id === tripId)?.listing?.status).toBe('pending');
  });

  it('exposes no update or delete path', async () => {
    const ctx = await setup();
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.planner));
    expect(proto.filter((name) => /event/i.test(name))).toEqual(['listEvents']);
  });
}
