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

describe('Planner-written reviews are moderated (ADR 0014)', () => {
  it('stay pending and invisible until staff approve', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const own = await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    expect(own.status).toBe('pending');
    expect((await planner.listApprovedReviews()).items).toEqual([]);

    const [queued] = await planner.listReviewQueue('pending');
    await planner.decideReview(queued!.id, 'approve', 'staff', null);
    const { items } = await planner.listApprovedReviews([PLACE]);
    expect(items).toHaveLength(1);
    expect(items[0]?.author).toBe('Hưng Trần');
  });

  it('keeps one review per author per place; an edit re-queues it', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
    const [first] = await planner.listReviewQueue();
    await planner.decideReview(first!.id, 'approve', 'staff', null);

    await planner.upsertPlannerReview(userId, PLACE, { ...review({ rating: 3 }), authorDisplay: 'anonymous' });
    expect(await planner.listReviewQueue()).toHaveLength(1);
    expect((await planner.listApprovedReviews()).items).toEqual([]);
    const [own] = await planner.listOwnReviews(userId);
    expect(own).toMatchObject({ status: 'pending', rating: 3, authorDisplay: 'anonymous' });
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

  it('excludes pending and rejected from the summary', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    await planner.upsertPlannerReview(userId, PLACE, { ...review(), authorDisplay: 'name' });
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
  });
});
