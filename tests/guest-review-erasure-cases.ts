import { expect, it, vi } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import { ERASED_REASON, ERASED_REVIEW_BODY, guestReviewInputSchema } from '../src/server/planner/schemas';
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
    expect((await ctx.store.read()).auditEvents.filter((e) => e.action !== 'user_create')).toEqual([]); // P07-13: provisioning the owner is logged

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

  it('erase: clears reports.note on every report of the review, keeps other reports, leaves no quoted text', async () => {
    const ctx = await setup();
    await guest(ctx);
    await guest(ctx, '203.0.113.50');
    const [a, b] = (await ctx.planner.listReviewQueue()).filter((r) => r.source === 'homepage');
    const note = 'Ghi lai: "so dien thoai 0900000000" cua Zeta';
    await ctx.planner.createReport({ targetKind: 'review', targetId: a!.id, reason: 'other', note }, { userId: null, clientKey: '198.51.100.5' });
    await ctx.planner.createReport({ targetKind: 'review', targetId: a!.id, reason: 'other', note }, { userId: null, clientKey: '198.51.100.6' });
    await ctx.planner.createReport({ targetKind: 'review', targetId: b!.id, reason: 'other', note: 'giu lai ghi chu nay' }, { userId: null, clientKey: '198.51.100.7' });
    const [first] = await ctx.planner.listReports('open');
    await ctx.planner.resolveReport(first!.id, { outcome: 'dismissed', reason: 'ok' }, 'staff-1'); // a handled report is wiped too

    await ctx.planner.eraseGuestReview(a!.id, 'staff-1', 'yêu cầu xóa');
    const rows = (await ctx.store.read()).reports;
    expect(rows.filter((r) => r.targetId === a!.id).map((r) => r.note)).toEqual([null, null]);
    expect(rows.find((r) => r.targetId === b!.id)!.note).toBe('giu lai ghi chu nay');
    expect(rows).toHaveLength(3);
    expect(JSON.stringify(rows)).not.toContain('Zeta');
    expect(JSON.stringify(rows)).not.toContain('0900000000');
  });

  it('erase: the original star is gone and the erased review is not in the average', async () => {
    const ctx = await setup();
    await guest(ctx); // 4 stars
    const id = await guestId(ctx);
    await ctx.planner.eraseGuestReview(id, 'staff-1', 'yêu cầu xóa');
    const row = (await ctx.store.read()).communityReviews.find((r) => r.id === id)!;
    expect(row.rating).toBe(1);
    expect(row.status).toBe('removed');
    expect((await ctx.planner.listApprovedReviews()).items).toEqual([]);
  });

  it('erase: the 20-per-place-per-day cap still counts an erased row', async () => {
    const ctx = await setup();
    for (let i = 0; i < 20; i += 1) await guest(ctx, `203.0.113.${i + 10}`);
    const id = await guestId(ctx);
    await ctx.planner.eraseGuestReview(id, 'staff-1', 'yêu cầu xóa');
    expect(await codeOf(guest(ctx, '203.0.113.99'))).toBe('rate_limited');
  });

  const MARK = 'ZZQUOTE-sensitive-fragment';
  /** A guest review with every place its text can leak to: reject-less remove reason, report note and handler reason, restriction reason. */
  const plant = async (ctx: ErasureCtx) => {
    await guest(ctx);
    const id = await guestId(ctx);
    await ctx.planner.decideReview(id, 'remove', 'staff-1', `vi phạm ${MARK}`);
    await ctx.planner.createReport({ targetKind: 'review', targetId: id, reason: 'spam', note: `trích ${MARK}` }, { userId: null, clientKey: '198.51.100.5' }).catch(() => undefined);
    return id;
  };

  it('erase: clears report notes, earlier audit reasons and restriction reasons; keeps non-identifying metadata', async () => {
    const ctx = await setup();
    await guest(ctx);
    const id = await guestId(ctx);
    await ctx.planner.createReport({ targetKind: 'review', targetId: id, reason: 'spam', note: `trích ${MARK}` }, { userId: null, clientKey: '198.51.100.5' });
    const { id: rst } = await ctx.planner.createRestriction({ reviewId: id, scope: 'place', reason: `lặp lại ${MARK}` }, 'staff-1');
    const [report] = await ctx.planner.listReports('open');
    await ctx.planner.resolveReport(report!.id, { outcome: 'actioned', reason: `đã đọc ${MARK}` }, 'staff-1');
    await ctx.planner.decideReview(id, 'remove', 'staff-1', `vi phạm ${MARK}`);
    expect(JSON.stringify(await ctx.store.read())).toContain(MARK);
    const before = (await ctx.store.read()).auditEvents.filter((e) => e.targetId === id || e.targetId === rst);

    await ctx.planner.eraseGuestReview(id, 'staff-2', 'Phiếu #42');
    const data = await ctx.store.read();
    const left = JSON.stringify(data).split(MARK).length - 1;
    expect(left).toBe(0);
    for (const dump of [JSON.stringify(data), await exportPlannerDocument(ctx.store)]) expect(dump).not.toContain(MARK);
    const restriction = data.reviewRestrictions.find((r) => r.id === rst)!;
    expect(restriction.reason).toBe(ERASED_REASON);
    expect(restriction.guestKey).toBeTruthy(); // abuse control stays until it ends
    expect(restriction.liftedAt).toBeNull();
    const after = data.auditEvents.filter((e) => e.targetId === id || e.targetId === rst);
    expect(after.map((e) => [e.id, e.actorId, e.action, e.fromStatus, e.toStatus, e.createdAt])).toEqual(
      [...before.map((e) => [e.id, e.actorId, e.action, e.fromStatus, e.toStatus, e.createdAt]), [expect.any(String), 'staff-2', 'erase', 'removed', 'removed', expect.any(String)]],
    );
    expect(after.filter((e) => e.action !== 'erase').every((e) => e.reason === null)).toBe(true);
    expect(after.find((e) => e.action === 'erase')!.reason).toBe('Phiếu #42');
    const [row] = await ctx.planner.listReports();
    expect(row).toMatchObject({ note: null, handlerReason: null, status: 'actioned', signedIn: false });
  });

  it('erase: leaves other reviews, reports and restrictions untouched', async () => {
    const ctx = await setup();
    await guest(ctx, '203.0.113.1');
    await guest(ctx, '203.0.113.2');
    const [a, b] = (await ctx.planner.listReviewQueue()).filter((r) => r.source === 'homepage');
    await ctx.planner.createReport({ targetKind: 'review', targetId: b!.id, reason: 'spam', note: `khác ${MARK}` }, { userId: null, clientKey: '198.51.100.6' });
    await ctx.planner.decideReview(b!.id, 'remove', 'staff-1', `lý do khác ${MARK}`);
    await ctx.planner.eraseGuestReview(a!.id, 'staff-1', 'yêu cầu xóa');
    const data = await ctx.store.read();
    expect(data.reports[0]!.note).toBe(`khác ${MARK}`);
    expect(data.auditEvents.find((e) => e.targetId === b!.id && e.action === 'remove')!.reason).toBe(`lý do khác ${MARK}`);
    expect(data.communityReviews.find((r) => r.id === b!.id)!.body).toBe(SECRET_TEXT);
  });

  it('erase: the original rating is gone and an erased review stays out of the public summary', async () => {
    const ctx = await setup();
    for (let i = 0; i < 3; i += 1) await guest(ctx, `203.0.113.${i + 1}`); // rating 4 each
    const queue = (await ctx.planner.listReviewQueue()).filter((r) => r.source === 'homepage');
    const before = (await ctx.planner.listApprovedReviews()).summary;
    expect(before.count).toBe(3);
    await ctx.planner.eraseGuestReview(queue[0]!.id, 'staff-1', 'yêu cầu xóa');
    const row = (await ctx.store.read()).communityReviews.find((r) => r.id === queue[0]!.id)!;
    expect(row.rating).toBe(1);
    const after = (await ctx.planner.listApprovedReviews()).summary;
    expect(after.count).toBe(2);
    if (after.average !== null) expect(after.average).toBe(4); // the placeholder 1 never enters the mean
  });

  it('erase: backfill — a review erased before the cleanup existed is cleaned on the next call, with no second erase event', async () => {
    const ctx = await setup();
    const id = await plant(ctx);
    await ctx.planner.eraseGuestReview(id, 'staff-1', 'yêu cầu xóa');
    // Simulate the PR #139 state: erased row, residue back in a report and an earlier event.
    await ctx.store.transact(async (data) => {
      data.reports = data.reports.map((r) => (r.targetId === id ? { ...r, note: `cũ ${MARK}` } : r));
      data.auditEvents = data.auditEvents.map((e) => (e.targetId === id && e.action === 'remove' ? { ...e, reason: `cũ ${MARK}` } : e));
    });
    expect(JSON.stringify(await ctx.store.read())).toContain(MARK);
    await ctx.planner.eraseGuestReview(id, 'staff-2', 'yêu cầu xóa lần hai');
    const data = await ctx.store.read();
    expect(JSON.stringify(data)).not.toContain(MARK);
    expect((await events(ctx, id)).filter((e) => e.action === 'erase')).toHaveLength(1);
  });
}
