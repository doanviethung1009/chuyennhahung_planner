import { expect, it, vi } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import { ERASED_REVIEW_BODY, guestReviewInputSchema } from '../src/server/planner/schemas';
import type { PlannerRepository } from '../src/server/planner/repository';
import type { PlannerStore } from '../src/server/planner/store';
import { exportPlannerDocument } from '../src/server/persistence/planner-transfer';
import { makeOwner } from './planner-helpers';

/** ADR 0024 §8: staff erase a guest review. Run on every store (memory here, PostgreSQL in the integration file). */
export interface ErasureCtx {
  planner: PlannerRepository;
  store: PlannerStore;
}

const PLACE = 'ho-xuan-huong';
const SECRET_TEXT = 'Chuyen rieng cua Nguyen Van Zeta ve cai ho nay, so dien thoai 0900000000, di vao buoi sang som.';
const NAME = 'Zeta Nguyen';

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return isContentError(e) ? e.code : 'other';
  }
  return 'ok';
};

export function registerErasureCases(setup: () => Promise<ErasureCtx>): void {
  const guest = (ctx: ErasureCtx, ip = '203.0.113.9') =>
    ctx.planner.createGuestReview(
      guestReviewInputSchema.parse({ placeSlug: PLACE, rating: 4, body: SECRET_TEXT, lang: 'vi', visitedOn: '2026-02-20', authorName: NAME }),
      ip,
    );
  const guestId = async (ctx: ErasureCtx) => (await ctx.planner.listReviewQueue()).find((r) => r.source === 'homepage')!.id;
  const events = async (ctx: ErasureCtx, id: string) => (await ctx.store.read()).auditEvents.filter((e) => e.targetId === id);

  it('erase: anonymises in place, leaves no content or key in the store or export, one event', async () => {
    const ctx = await setup();
    await guest(ctx);
    const id = await guestId(ctx);
    const keyBefore = (await ctx.store.read()).communityReviews[0]!.guestKey;
    expect(keyBefore).toBeTruthy();
    await ctx.planner.eraseGuestReview(id, 'staff-1', 'Thư ngày 17/11, phiếu #42');

    const row = (await ctx.store.read()).communityReviews.find((r) => r.id === id)!;
    expect(row).toMatchObject({ status: 'removed', body: ERASED_REVIEW_BODY, authorName: null, guestKey: null, rejectReason: null, rating: 1, placeSlug: PLACE, source: 'homepage', decidedBy: 'staff-1' });
    expect(row.visitedOn).toBe(row.createdAt.slice(0, 10));
    for (const dump of [JSON.stringify(await ctx.store.read()), await exportPlannerDocument(ctx.store)]) {
      expect(dump).not.toContain('Zeta');
      expect(dump).not.toContain('0900000000');
      expect(dump).not.toContain(keyBefore!);
    }
    const evs = await events(ctx, id);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ action: 'erase', fromStatus: 'approved', toStatus: 'removed', actorId: 'staff-1', reason: 'Thư ngày 17/11, phiếu #42' });
    expect(JSON.stringify(evs)).not.toContain(keyBefore!);
    expect((await ctx.planner.listApprovedReviews()).items).toEqual([]);
    const [item] = await ctx.planner.listReviewQueue();
    expect(item).toMatchObject({ erased: true, author: null, status: 'removed' });
  });

  it('erase: idempotent (second call writes no event) and reaches an already removed review', async () => {
    const ctx = await setup();
    await guest(ctx);
    const id = await guestId(ctx);
    await ctx.planner.decideReview(id, 'remove', 'staff-1', 'vi phạm');
    expect((await ctx.store.read()).communityReviews[0]!.body).toBe(SECRET_TEXT); // a plain remove keeps the text
    await ctx.planner.eraseGuestReview(id, 'staff-2', 'yêu cầu xóa');
    await ctx.planner.eraseGuestReview(id, 'staff-2', 'yêu cầu xóa');
    expect((await events(ctx, id)).map((e) => e.action)).toEqual(['remove', 'erase']);
    expect((await events(ctx, id))[1]).toMatchObject({ fromStatus: 'removed', toStatus: 'removed' });
    expect(JSON.stringify(await ctx.store.read())).not.toContain('Zeta');
  });

  it('erase: refuses a Planner review and an unknown id; writes nothing on failure', async () => {
    const ctx = await setup();
    const { userId } = await makeOwner(ctx.planner);
    await ctx.planner.upsertPlannerReview(userId, PLACE, { rating: 5, body: SECRET_TEXT, lang: 'vi', visitedOn: '2026-02-20', authorDisplay: 'name' });
    const id = (await ctx.planner.listReviewQueue())[0]!.id;
    expect(await codeOf(ctx.planner.eraseGuestReview(id, 's', 'lý do'))).toBe('invalid_state');
    expect(await codeOf(ctx.planner.eraseGuestReview('rev_nope', 's', 'lý do'))).toBe('not_found');
    expect((await ctx.store.read()).auditEvents).toEqual([]);

    await guest(ctx);
    const gid = (await ctx.planner.listReviewQueue()).find((r) => r.source === 'homepage')!.id;
    const before = JSON.stringify(await ctx.store.read());
    const original = ctx.store.transact.bind(ctx.store);
    const spy = vi.spyOn(ctx.store, 'transact').mockImplementation((fn) =>
      original(async (data) => {
        await fn(data);
        throw new Error('forced');
      }),
    );
    await expect(ctx.planner.eraseGuestReview(gid, 's', 'lý do')).rejects.toThrow('forced');
    spy.mockRestore();
    expect(JSON.stringify(await ctx.store.read())).toBe(before);
  });

  it('erase: an open report on the review still resolves', async () => {
    const ctx = await setup();
    await guest(ctx);
    const id = await guestId(ctx);
    await ctx.planner.createReport({ targetKind: 'review', targetId: id, reason: 'spam' }, { userId: null, clientKey: '198.51.100.5' });
    await ctx.planner.eraseGuestReview(id, 'staff-1', 'yêu cầu xóa');
    const [report] = await ctx.planner.listReports('open');
    expect(report).toBeTruthy();
    expect(await ctx.planner.resolveReport(report!.id, { outcome: 'actioned', reason: 'đã xóa' }, 'staff-1')).toBe('actioned');
  });

  it('erase: the 20-per-place-per-day cap still counts an erased row', async () => {
    const ctx = await setup();
    for (let i = 0; i < 20; i += 1) await guest(ctx, `203.0.113.${i + 10}`);
    const id = await guestId(ctx);
    await ctx.planner.eraseGuestReview(id, 'staff-1', 'yêu cầu xóa');
    expect(await codeOf(guest(ctx, '203.0.113.99'))).toBe('rate_limited');
  });
}
