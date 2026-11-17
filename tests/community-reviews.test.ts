import { describe, expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import {
  createRestrictionSchema,
  guestReviewInputSchema,
  plannerReviewInputSchema,
  reviewDecisionSchema,
} from '../src/server/planner/schemas';
import { can } from '../src/server/identity/permissions';
import { makeClock, makeOwner, makePlanner } from './planner-helpers';

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (!isContentError(error)) throw error;
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}, but it resolved`);
}

const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
const PLACE = 'ho-xuan-huong';
const review = (over: Record<string, unknown> = {}) => ({
  rating: 5,
  body: BODY,
  lang: 'vi' as const,
  visitedOn: '2026-02-20',
  ...over,
});

describe('Planner-written reviews are published at once (ADR 0014)', () => {
  it('go live immediately, and staff can remove them afterwards', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const own = await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    expect(own.status).toBe('approved');
    const { items } = await planner.listApprovedReviews([PLACE]);
    expect(items).toHaveLength(1);
    expect(items[0]?.author).toBe('Hưng Trần');

    const [queued] = await planner.listReviewQueue();
    await planner.decideReview(queued!.id, 'remove', 'staff', 'vi phạm');
    expect((await planner.listApprovedReviews()).items).toEqual([]);
  });

  it('keeps one review per author per place; an edit replaces it and stays live', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    await planner.upsertPlannerReview(userId, PLACE, { ...review({ rating: 3 }), authorDisplay: 'anonymous' });
    expect(await planner.listReviewQueue()).toHaveLength(1);
    const { items } = await planner.listApprovedReviews();
    expect(items[0]).toMatchObject({ rating: 3, author: null });
    expect((await planner.listOwnReviews(userId))[0]).toMatchObject({ status: 'approved', authorDisplay: 'anonymous' });
  });

  it('lets the author delete their own, and only theirs', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const other = await makeOwner(planner, 'khac');
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    await planner.deleteOwnReview(other.userId, PLACE);
    expect(await planner.listOwnReviews(userId)).toHaveLength(1);
    await planner.deleteOwnReview(userId, PLACE);
    expect(await planner.listOwnReviews(userId)).toEqual([]);
  });

  it('does not let an author overwrite or delete a staff removal', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    const [row] = await planner.listReviewQueue();
    await planner.decideReview(row!.id, 'remove', 'staff', 'vi phạm');

    await expectCode(
      planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' }),
      'invalid_state',
    );
    await planner.deleteOwnReview(userId, PLACE);
    const [after] = await planner.listReviewQueue();
    expect(after).toMatchObject({ status: 'removed', rejectReason: 'vi phạm' });
    expect((await planner.listApprovedReviews()).items).toEqual([]);
  });

  it('rejects an unknown place and a future visit date', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await expectCode(
      planner.upsertPlannerReview(userId, 'khong-co', { ...review(), authorDisplay: 'name' }),
      'invalid_reference',
    );
    await expectCode(
      planner.upsertPlannerReview(userId, PLACE, { ...review({ visitedOn: '2026-12-31' }), authorDisplay: 'name' }),
      'invalid_reference',
    );
  });

  it('is removed with the account', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    await planner.deleteUser(userId);
    expect(await planner.listReviewQueue()).toEqual([]);
  });
});

describe('staff can hold a review and ask its author (ADR 0015)', () => {
  async function held() {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    const [row] = await planner.listReviewQueue();
    await planner.decideReview(row!.id, 'hold', 'staff', 'Bạn đã đến đó thật chứ?');
    return { planner, userId, id: row!.id };
  }

  it('hides the review from public reads and the average, and shows the author the question', async () => {
    const { planner, userId } = await held();
    expect((await planner.listApprovedReviews()).items).toEqual([]);
    expect((await planner.listApprovedReviews()).summary.count).toBe(0);
    expect((await planner.listOwnReviews(userId))[0]).toMatchObject({
      status: 'held',
      rejectReason: 'Bạn đã đến đó thật chứ?',
    });
    expect((await planner.listReviewQueue())[0]).toMatchObject({ status: 'held' });
  });

  it('is republished by the author edit, with the question cleared', async () => {
    const { planner, userId } = await held();
    await planner.upsertPlannerReview(userId, PLACE, { ...review({ rating: 4 }), authorDisplay: 'name' });
    expect((await planner.listApprovedReviews()).items).toHaveLength(1);
    expect((await planner.listOwnReviews(userId))[0]).toMatchObject({ status: 'approved', rejectReason: null });
  });

  it('can still be removed by staff, and then stays closed to the author', async () => {
    const { planner, userId, id } = await held();
    await planner.decideReview(id, 'remove', 'staff', 'không trả lời');
    await expectCode(
      planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' }),
      'invalid_state',
    );
  });

  it('lets the author delete a held review of their own', async () => {
    const { planner, userId } = await held();
    await planner.deleteOwnReview(userId, PLACE);
    expect(await planner.listOwnReviews(userId)).toEqual([]);
  });

  it('refuses to hold a guest review, a non-live review, or a held one twice', async () => {
    const planner = makePlanner();
    await planner.createGuestReview({ placeSlug: PLACE, ...review(), authorName: null }, '203.0.113.9');
    const [guest] = await planner.listReviewQueue();
    await expectCode(planner.decideReview(guest!.id, 'hold', 'staff', 'câu hỏi'), 'invalid_state');
    const { planner: other, id } = await held();
    await expectCode(other.decideReview(id, 'hold', 'staff', 'lại'), 'invalid_state');
  });
});

describe('staff can switch off a review author (ADR 0015)', () => {
  const OTHER = 'vuon-ca-phe-me-linh';

  async function twoReviews() {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    await planner.upsertPlannerReview(userId, OTHER, { ...review(), authorDisplay: 'name' });
    const queue = await planner.listReviewQueue();
    const at = (place: string) => queue.find((item) => item.placeSlug === place)!.id;
    return { planner, userId, atPlace: at(PLACE), atOther: at(OTHER) };
  }

  it('hides and blocks an author for one place only, and lifting restores it', async () => {
    const { planner, userId, atPlace } = await twoReviews();
    const { id } = await planner.createRestriction({ reviewId: atPlace, scope: 'place', reason: 'nội dung sai' }, 'admin_1');
    expect((await planner.listApprovedReviews()).items.map((item) => item.placeSlug)).toEqual([OTHER]);
    await expectCode(
      planner.upsertPlannerReview(userId, PLACE, { ...review({ rating: 2 }), authorDisplay: 'name' }),
      'forbidden',
    );
    // Another place is unaffected.
    await planner.upsertPlannerReview(userId, OTHER, { ...review({ rating: 3 }), authorDisplay: 'name' });
    expect((await planner.listOwnRestrictions(userId))[0]).toMatchObject({ placeSlug: PLACE, reason: 'nội dung sai' });

    await planner.liftRestriction(id, 'admin_1');
    await planner.liftRestriction(id, 'admin_1');
    expect((await planner.listApprovedReviews()).items).toHaveLength(2);
    expect(await planner.listOwnRestrictions(userId)).toEqual([]);
    const [row] = await planner.listRestrictions();
    expect(row).toMatchObject({ active: false, liftedBy: 'admin_1', createdBy: 'admin_1' });
  });

  it('with scope all, covers every place of that author only', async () => {
    const { planner, userId, atPlace } = await twoReviews();
    const bystander = await makeOwner(planner, 'khac');
    await planner.upsertPlannerReview(bystander.userId, PLACE, { ...review(), authorDisplay: 'name' });
    await planner.createRestriction({ reviewId: atPlace, scope: 'all', reason: 'lạm dụng' }, 'service');
    expect((await planner.listApprovedReviews()).items).toHaveLength(1);
    await expectCode(
      planner.upsertPlannerReview(userId, OTHER, { ...review(), authorDisplay: 'name' }),
      'forbidden',
    );
    await planner.upsertPlannerReview(bystander.userId, OTHER, { ...review(), authorDisplay: 'name' });
  });

  it('lets a restricted author still delete their own live review', async () => {
    const { planner, userId, atPlace } = await twoReviews();
    await planner.createRestriction({ reviewId: atPlace, scope: 'all', reason: 'lạm dụng' }, 'service');
    await planner.deleteOwnReview(userId, PLACE);
    expect((await planner.listOwnReviews(userId)).map((item) => item.placeSlug)).toEqual([OTHER]);
  });

  it('refuses a duplicate, and an unknown review', async () => {
    const { planner, atPlace } = await twoReviews();
    const body = { reviewId: atPlace, scope: 'place' as const, reason: 'nội dung sai' };
    await planner.createRestriction(body, 'service');
    await expectCode(planner.createRestriction(body, 'service'), 'invalid_state');
    await expectCode(planner.createRestriction({ ...body, reviewId: 'rev_none' }, 'service'), 'not_found');
  });

  it('never restricts an account that holds a moderation permission', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.setUserRole(userId, 'editor');
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    const [row] = await planner.listReviewQueue();
    await expectCode(planner.createRestriction({ reviewId: row!.id, scope: 'all', reason: 'thử' }, 'service'), 'forbidden');
  });

  it('time-boxes a guest, refuses the shared key, and blocks only that key', async () => {
    const planner = makePlanner();
    const guest = (key: string) =>
      planner.createGuestReview({ placeSlug: PLACE, ...review(), authorName: null }, key);
    await guest('198.51.100.7');
    await guest('unknown');
    const queue = await planner.listReviewQueue();
    const bySource = queue.filter((item) => item.source === 'homepage');
    expect(bySource).toHaveLength(2);

    const results = await Promise.allSettled(
      bySource.map((item) => planner.createRestriction({ reviewId: item.id, scope: 'place', reason: 'spam lặp lại' }, 'service')),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rejected.reason as { code: string }).code).toBe('invalid_state');

    const [row] = await planner.listRestrictions();
    const days = (Date.parse(row!.expiresAt!) - Date.parse(row!.createdAt)) / 86_400_000;
    expect(days).toBe(30);
    expect(JSON.stringify(await planner.listRestrictions())).not.toMatch(/guestKey|authorId/);

    await expectCode(guest('198.51.100.7'), 'forbidden');
    await guest('198.51.100.8');
  });

  it('restricts a guest for the review\'s place only', async () => {
    const planner = makePlanner();
    await planner.createGuestReview({ placeSlug: PLACE, ...review(), authorName: null }, '198.51.100.7');
    const [row] = await planner.listReviewQueue();
    await expectCode(
      planner.createRestriction({ reviewId: row!.id, scope: 'all', reason: 'spam lặp lại' }, 'service'),
      'invalid_reference',
    );
  });

  it('caps a guest restriction at 90 days and rejects a past expiry', async () => {
    const planner = makePlanner();
    await planner.createGuestReview({ placeSlug: PLACE, ...review(), authorName: null }, '198.51.100.7');
    const [row] = await planner.listReviewQueue();
    const base = { reviewId: row!.id, scope: 'place' as const, reason: 'spam lặp lại' };
    await expectCode(
      planner.createRestriction({ ...base, expiresAt: '2027-12-31T00:00:00.000Z' }, 'service'),
      'invalid_reference',
    );
    await expectCode(
      planner.createRestriction({ ...base, expiresAt: '2026-01-01T00:00:00.000Z' }, 'service'),
      'invalid_reference',
    );
  });

  it('ends on its own at the expiry', async () => {
    const clock = makeClock();
    const planner = makePlanner({ now: clock.now });
    await planner.createGuestReview({ placeSlug: PLACE, ...review(), authorName: null }, '198.51.100.7');
    const [row] = await planner.listReviewQueue();
    const { id } = await planner.createRestriction(
      { reviewId: row!.id, scope: 'place', reason: 'spam lặp lại', expiresAt: '2026-03-02T08:00:00.000Z' },
      'service',
    );
    expect((await planner.listRestrictions(true)).map((r) => r.id)).toEqual([id]);
    expect((await planner.listApprovedReviews()).items).toEqual([]);
    clock.advanceMinutes(25 * 60);
    expect(await planner.listRestrictions(true)).toEqual([]);
    expect((await planner.listApprovedReviews()).items).toHaveLength(1);
  });

  it('ends, but is kept, when the account is deleted', async () => {
    const { planner, userId, atPlace } = await twoReviews();
    await planner.createRestriction({ reviewId: atPlace, scope: 'all', reason: 'lạm dụng' }, 'service');
    await planner.deleteUser(userId);
    // The record stays, ended, with no name left to show.
    expect(await planner.listRestrictions()).toMatchObject([
      { active: false, liftedBy: 'account deleted', author: null, reason: 'lạm dụng' },
    ]);
  });

  it('marks restricted reviews in the staff queue, and keeps the public projection', async () => {
    const { planner, atPlace } = await twoReviews();
    await planner.createRestriction({ reviewId: atPlace, scope: 'place', reason: 'nội dung sai' }, 'service');
    const queue = await planner.listReviewQueue();
    expect(queue.find((item) => item.id === atPlace)?.restricted).toBe(true);
    expect(JSON.stringify(queue)).not.toMatch(/authorId|guestKey/);
    const [item] = (await planner.listApprovedReviews()).items;
    expect(Object.keys(item!).sort()).toEqual(
      ['author', 'body', 'createdAt', 'id', 'lang', 'placeSlug', 'rating', 'visitedOn'].sort(),
    );
  });

  it('is a permission of admin and service, not editor', () => {
    expect(can({ role: 'editor' }, 'community:restrict')).toBe(false);
    expect(can({ role: 'admin' }, 'community:restrict')).toBe(true);
    expect(can({ role: 'service' }, 'community:restrict')).toBe(true);
    expect(can({ role: 'member' }, 'community:restrict')).toBe(false);
  });

  it('validates the body strictly', () => {
    const ok = { reviewId: 'rev_1', scope: 'place', reason: 'nội dung sai' };
    expect(createRestrictionSchema.safeParse(ok).success).toBe(true);
    expect(createRestrictionSchema.safeParse({ ...ok, authorId: 'x' }).success).toBe(false);
    expect(createRestrictionSchema.safeParse({ ...ok, reason: 'a' }).success).toBe(false);
    expect(createRestrictionSchema.safeParse({ ...ok, scope: 'region' }).success).toBe(false);
  });
});

describe('guest reviews are published at once and bounded', () => {
  const guest = (over: Record<string, unknown> = {}) =>
    guestReviewInputSchema.parse({ placeSlug: PLACE, ...review(), authorName: null, ...over });

  it('is public immediately, with staff able only to remove it', async () => {
    const planner = makePlanner();
    await planner.createGuestReview(guest({ authorName: 'Lan' }), '1.1.1.1');
    const { items } = await planner.listApprovedReviews([PLACE]);
    expect(items[0]?.author).toBe('Lan');

    const [queued] = await planner.listReviewQueue();
    await expectCode(planner.decideReview(queued!.id, 'approve', 's', null), 'invalid_state');
    await planner.decideReview(queued!.id, 'remove', 's', 'spam');
    expect((await planner.listApprovedReviews()).items).toEqual([]);
  });

  it('allows one per place per client per 24 hours', async () => {
    const clock = makeClock();
    const planner = makePlanner({ now: clock.now });
    await planner.createGuestReview(guest(), '1.1.1.1');
    await expectCode(planner.createGuestReview(guest(), '1.1.1.1'), 'invalid_state');
    await planner.createGuestReview(guest(), '2.2.2.2');
    clock.advanceDays(2);
    await planner.createGuestReview(guest(), '1.1.1.1');
  });

  it('caps one place at 20 a day however many clients', async () => {
    const planner = makePlanner();
    for (let i = 0; i < 20; i++) await planner.createGuestReview(guest(), `10.0.0.${i}`);
    await expectCode(planner.createGuestReview(guest(), '10.9.9.9'), 'rate_limited');
  });

  it('never stores the address, only a hash', async () => {
    const planner = makePlanner();
    await planner.createGuestReview(guest(), '203.0.113.7');
    const text = JSON.stringify(await planner.listReviewQueue()) + JSON.stringify(await planner.listApprovedReviews());
    expect(text).not.toContain('203.0.113.7');
  });
});

describe('public projection and summary', () => {
  it('names exactly the allowed fields', async () => {
    const planner = makePlanner();
    await planner.createGuestReview(
      guestReviewInputSchema.parse({ placeSlug: PLACE, ...review(), authorName: 'Lan' }),
      '1.1.1.1',
    );
    const [item] = (await planner.listApprovedReviews()).items;
    expect(Object.keys(item ?? {}).sort()).toEqual(
      ['author', 'body', 'createdAt', 'id', 'lang', 'placeSlug', 'rating', 'visitedOn'].sort(),
    );
  });

  it('hides the average below three approved reviews', async () => {
    const planner = makePlanner();
    for (const [i, rating] of [5, 4].entries()) {
      await planner.createGuestReview(
        guestReviewInputSchema.parse({ placeSlug: PLACE, ...review({ rating }), authorName: null }),
        `9.9.9.${i}`,
      );
    }
    expect((await planner.listApprovedReviews([PLACE])).summary).toEqual({ count: 2, average: null });
    await planner.createGuestReview(
      guestReviewInputSchema.parse({ placeSlug: PLACE, ...review({ rating: 3 }), authorName: null }),
      '9.9.9.9',
    );
    expect((await planner.listApprovedReviews([PLACE])).summary).toEqual({ count: 3, average: 4 });
  });

  it('excludes removed reviews from the summary', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    expect((await planner.listApprovedReviews()).summary.count).toBe(1);
    const [row] = await planner.listReviewQueue();
    await planner.decideReview(row!.id, 'remove', 's', 'spam');
    expect((await planner.listApprovedReviews()).summary.count).toBe(0);
  });
});

describe('review schemas', () => {
  it('requires a body of 60–1000 characters, a rating of 1–5 and a date', () => {
    expect(plannerReviewInputSchema.safeParse({ ...review(), authorDisplay: 'name' }).success).toBe(true);
    expect(plannerReviewInputSchema.safeParse({ ...review({ body: 'ngắn' }), authorDisplay: 'name' }).success).toBe(false);
    expect(plannerReviewInputSchema.safeParse({ ...review({ body: 'x'.repeat(1001) }), authorDisplay: 'name' }).success).toBe(false);
    expect(plannerReviewInputSchema.safeParse({ ...review({ rating: 6 }), authorDisplay: 'name' }).success).toBe(false);
    const noDate: Record<string, unknown> = review();
    delete noDate.visitedOn;
    expect(plannerReviewInputSchema.safeParse({ ...noDate, authorDisplay: 'name' }).success).toBe(false);
  });

  it('refuses status and unknown fields from a client', () => {
    expect(plannerReviewInputSchema.safeParse({ ...review(), authorDisplay: 'name', status: 'approved' }).success).toBe(false);
    expect(guestReviewInputSchema.safeParse({ placeSlug: PLACE, ...review(), source: 'planner' }).success).toBe(false);
  });

  it('keeps HTML as inert text', () => {
    const body = `<script>alert(1)</script> ${BODY}`;
    expect(guestReviewInputSchema.parse({ placeSlug: PLACE, ...review({ body }) }).body).toBe(body);
  });

  it('needs a reason to reject or remove', () => {
    expect(reviewDecisionSchema.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(reviewDecisionSchema.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ decision: 'hold' }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ decision: 'hold', reason: 'Bạn đã đến đó chưa?' }).success).toBe(true);
  });
});
