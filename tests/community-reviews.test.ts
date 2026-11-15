import { describe, expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import {
  guestReviewInputSchema,
  plannerReviewInputSchema,
  reviewDecisionSchema,
} from '../src/server/planner/schemas';
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
      ['author', 'body', 'createdAt', 'lang', 'placeSlug', 'rating', 'visitedOn'].sort(),
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
