import { expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import type { PlannerRepository } from '../src/server/planner/repository';
import type { PlannerStore } from '../src/server/planner/store';
import { activityInput, daLatTripInput } from './planner-helpers';

/**
 * ADR 0019 §4 Creator Terms, written once and run against every store: the
 * memory store in `terms-acceptance.test.ts` and PostgreSQL in the integration
 * file (skipped without `TEST_DATABASE_URL`). `setup(version)` builds a
 * repository whose current terms version is `version`.
 */
export interface TermsCtx {
  planner: PlannerRepository;
  store: PlannerStore;
}

async function reasonOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
  } catch (error) {
    if (!isContentError(error)) throw error;
    expect(error.code).toBe('forbidden');
    return error.reason;
  }
  throw new Error('expected a refusal, but it resolved');
}

export function registerTermsCases(setup: (termsVersion: string, same?: TermsCtx) => Promise<TermsCtx>): void {
  async function member(ctx: TermsCtx, handle: string) {
    const issued = await ctx.planner.createUser({ handle, displayName: 'Người dùng', role: 'member' });
    return issued.user.id;
  }

  it('is closed until the current version is accepted, then open', async () => {
    const ctx = await setup('v1');
    const { planner } = ctx;
    const id = await member(ctx, 'terms-a');
    expect(await planner.termsStatus(id)).toEqual({ version: 'v1', accepted: false, acceptedAt: null });
    expect(await reasonOf(planner.requireTermsAccepted(id))).toBe('terms_not_accepted');
    const result = await planner.acceptTerms(id, 'v1', 'vi');
    expect(result).toMatchObject({ version: 'v1', accepted: true });
    await planner.requireTermsAccepted(id);
    expect((await planner.termsStatus(id)).accepted).toBe(true);
  });

  it('is idempotent: a repeat keeps the first time, stores one row and logs one event', async () => {
    const ctx = await setup('v1');
    const id = await member(ctx, 'terms-b');
    const first = await ctx.planner.acceptTerms(id, 'v1', 'vi');
    const again = await ctx.planner.acceptTerms(id, 'v1', 'en');
    expect(again.acceptedAt).toBe(first.acceptedAt);
    const data = await ctx.store.read();
    expect(data.termsAcceptances.filter((r) => r.userId === id)).toHaveLength(1);
    expect(data.termsAcceptances[0]).toMatchObject({ userId: id, version: 'v1', lang: 'vi' });
    const events = data.auditEvents.filter((e) => e.action === 'terms_accepted');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ targetKind: 'user', targetId: id, actorId: id, actorKind: 'user', fromStatus: null, toStatus: 'v1' });
  });

  it('is per user, and a version bump closes the gate again', async () => {
    const ctx = await setup('v1');
    const a = await member(ctx, 'terms-c');
    const b = await member(ctx, 'terms-d');
    await ctx.planner.acceptTerms(a, 'v1', 'vi');
    expect(await reasonOf(ctx.planner.requireTermsAccepted(b))).toBe('terms_not_accepted');

    const bumped = (await setup('v2', ctx)).planner; // same store, newer version
    expect(await reasonOf(bumped.requireTermsAccepted(a))).toBe('terms_not_accepted');
    await bumped.acceptTerms(a, 'v2', 'vi');
    await bumped.requireTermsAccepted(a);
    expect((await ctx.store.read()).termsAcceptances.filter((r) => r.userId === a)).toHaveLength(2);
  });

  it('refuses a version that is not the current one, and logs nothing', async () => {
    const ctx = await setup('v1');
    const id = await member(ctx, 'terms-e');
    await expect(ctx.planner.acceptTerms(id, 'v0', 'vi')).rejects.toMatchObject({ code: 'bad_request' });
    await expect(ctx.planner.acceptTerms('usr_missing', 'v1', 'vi')).rejects.toMatchObject({ code: 'not_found' });
    const data = await ctx.store.read();
    expect(data.termsAcceptances).toEqual([]);
    expect(data.auditEvents.filter((e) => e.action === 'terms_accepted')).toEqual([]);
  });

  it('never gates reads, withdrawing a listing or deleting one\'s own review', async () => {
    const ctx = await setup('v1');
    const id = await member(ctx, 'terms-f');
    // The member accepted under an older version; the gate is now closed for them.
    await (await setup('v0', ctx)).planner.acceptTerms(id, 'v0', 'vi');
    const view = await ctx.planner.createTrip(id, daLatTripInput({ title: 'Đà Lạt ba ngày' }));
    await ctx.planner.addActivity(id, view.trip.id, activityInput(), null);
    await ctx.planner.setVisibility(id, view.trip.id, 'public');
    await ctx.planner.requestListing(id, view.trip.id, 'name'); // repository itself is not the gate (routes call it)
    await ctx.planner.withdrawListing(id, view.trip.id);
    await ctx.planner.deleteOwnReview(id, 'ho-xuan-huong');
    expect(await ctx.planner.termsStatus(id)).toMatchObject({ accepted: false });
  });

  it('drops a user\'s acceptances when the account is deleted', async () => {
    const ctx = await setup('v1');
    const id = await member(ctx, 'terms-g');
    await ctx.planner.acceptTerms(id, 'v1', 'vi');
    await ctx.planner.deleteUser(id);
    expect((await ctx.store.read()).termsAcceptances.filter((r) => r.userId === id)).toEqual([]);
  });
}
