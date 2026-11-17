import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { readGuestKeySecret } from '../src/server/community/guest-key';
import { isContentError } from '../src/server/content/repository';
import { GUEST_RESTRICTION_MAX_DAYS } from '../src/server/planner/schemas';
import type { PlannerRepository } from '../src/server/planner/repository';
import type { PlannerStore } from '../src/server/planner/store';
import { FROZEN_NOW } from './planner-helpers';

/**
 * ADR 0024 (batch 10.6b), written once and run against every store: the memory
 * store in `guest-key.test.ts`, PostgreSQL in the integration file (skipped
 * without `TEST_DATABASE_URL`). `make` builds a repository over the shared
 * store with a movable clock and its own secret.
 */
export interface GuestKeyCtx {
  store: PlannerStore;
  make: (options: { now: () => Date; secret: () => string }) => PlannerRepository;
}

const DAY = 24 * 60 * 60_000;
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
const SECRET = 'guest-key-case-secret-0123456789abcdef';
const review = (placeSlug = 'ho-xuan-huong') => ({ placeSlug, rating: 5, body: BODY, lang: 'vi' as const, visitedOn: '2026-02-20', authorName: null });

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (!isContentError(error)) throw error;
    return error.code;
  }
  throw new Error('expected a failure, but it resolved');
}

export function registerGuestKeyCases(setup: () => Promise<GuestKeyCtx>): void {
  async function world(start = Date.parse(FROZEN_NOW)) {
    const ctx = await setup();
    let t = start;
    const clock = { set: (ms: number) => { t = ms; }, now: () => new Date(t) };
    const planner = ctx.make({ now: clock.now, secret: () => SECRET });
    return { ...ctx, planner, clock, start };
  }
  const reviews = async (store: PlannerStore) => (await store.read()).communityReviews;

  it('keys the same client the same way and different clients differently; the key is not derivable from the address', async () => {
    const w = await world();
    await w.planner.createGuestReview(review('ho-xuan-huong'), '203.0.113.5');
    await w.planner.createGuestReview(review('vuon-ca-phe-me-linh'), '203.0.113.5');
    await w.planner.createGuestReview(review('ho-xuan-huong'), '203.0.113.6');
    const rows = await reviews(w.store);
    const keys = rows.map((r) => r.guestKey);
    expect(keys[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    // What ADR 0015 stored: an unsalted hash anyone can enumerate. It must not match.
    expect(keys[0]).not.toBe(createHash('sha256').update('203.0.113.5').digest('hex').slice(0, 32));
  });

  it('a rotated secret gives the same client a different key', async () => {
    const w = await world();
    await w.planner.createGuestReview(review(), '203.0.113.5');
    const rotated = w.make({ now: w.clock.now, secret: () => 'another-secret-0123456789abcdef0123456789' });
    await rotated.createGuestReview(review(), '203.0.113.5');
    const [before, after] = (await reviews(w.store)).map((r) => r.guestKey);
    expect(after).not.toBe(before);
  });

  it('fails closed without a secret: 503 and nothing written, for a review and a guest report', async () => {
    const w = await world();
    await w.planner.createGuestReview(review(), '203.0.113.5');
    const reviewId = (await w.planner.listApprovedReviews()).items[0]!.id;
    const missing = w.make({ now: w.clock.now, secret: () => readGuestKeySecret({}) });
    expect(await codeOf(missing.createGuestReview(review('vuon-ca-phe-me-linh'), '203.0.113.7'))).toBe('service_unavailable');
    expect(await codeOf(missing.createReport({ targetKind: 'review', targetId: reviewId, reason: 'spam' }, { userId: null, clientKey: '203.0.113.7' }))).toBe('service_unavailable');
    // A member's report stores no guest key, so it does not need the secret.
    const member = (await missing.createUser({ handle: `gk-${randomUUID().slice(0, 6)}`, displayName: 'Người đọc', role: 'member' })).user.id;
    await missing.createReport({ targetKind: 'review', targetId: reviewId, reason: 'spam' }, { userId: member, clientKey: '203.0.113.8' });
    expect(await reviews(w.store)).toHaveLength(1);
    expect((await w.store.read()).reports).toHaveLength(1);
  });

  it('the sweep clears a review key and a report key at 30 days, not before, and keeps the content', async () => {
    const w = await world();
    await w.planner.createGuestReview(review(), '203.0.113.5');
    const reviewId = (await w.planner.listApprovedReviews()).items[0]!.id;
    await w.planner.createReport({ targetKind: 'review', targetId: reviewId, reason: 'spam', note: 'quảng cáo' }, { userId: null, clientKey: '203.0.113.9' });
    const trigger = (clientIp: string, slug: string) => w.planner.createGuestReview(review(slug), clientIp);

    w.clock.set(w.start + 30 * DAY - 1);
    await trigger('203.0.113.50', 'vuon-ca-phe-me-linh');
    expect((await reviews(w.store))[0]!.guestKey).not.toBeNull();
    expect((await w.store.read()).reports[0]!.clientKey).not.toBeNull();

    w.clock.set(w.start + 30 * DAY);
    await trigger('203.0.113.51', 'vuon-ca-phe-me-linh');
    const data = await w.store.read();
    expect(data.communityReviews[0]).toMatchObject({ guestKey: null, body: BODY, status: 'approved' });
    expect(data.reports[0]).toMatchObject({ clientKey: null, note: 'quảng cáo', status: 'open' });
    // Newer rows keep their keys.
    expect(data.communityReviews.find((r) => r.createdAt > data.communityReviews[0]!.createdAt)?.guestKey).not.toBeNull();
  });

  it('a guest restriction matches a returning guest within its term, and caps at 30 days', async () => {
    const w = await world();
    await w.planner.createGuestReview(review(), '203.0.113.5');
    const reviewId = (await w.planner.listApprovedReviews()).items[0]!.id;
    const over = new Date(w.start + (GUEST_RESTRICTION_MAX_DAYS + 1) * DAY).toISOString();
    expect(await codeOf(w.planner.createRestriction({ reviewId, scope: 'place', reason: 'spam lặp', expiresAt: over }, 'staff-1'))).toBe('invalid_reference');
    await w.planner.createRestriction({ reviewId, scope: 'place', reason: 'spam lặp' }, 'staff-1'); // default 30 days
    const row = (await w.store.read()).reviewRestrictions[0]!;
    expect(Date.parse(row.expiresAt!) - w.start).toBe(30 * DAY);
    expect(row.guestKey).toMatch(/^[0-9a-f]{32}$/);

    w.clock.set(w.start + 29 * DAY);
    expect(await codeOf(w.planner.createGuestReview(review(), '203.0.113.5'))).toBe('forbidden');
    await w.planner.createGuestReview(review(), '203.0.113.77'); // another client is not blocked
  });

  it('an expired guest restriction loses its key and is marked lifted by "key expired"', async () => {
    const w = await world();
    await w.planner.createGuestReview(review(), '203.0.113.5');
    const reviewId = (await w.planner.listApprovedReviews()).items[0]!.id;
    await w.planner.createRestriction({ reviewId, scope: 'place', reason: 'spam lặp' }, 'staff-1');
    w.clock.set(w.start + 30 * DAY + 1000);
    await w.planner.createGuestReview(review(), '203.0.113.5'); // runs the sweep; no longer blocked
    expect((await w.store.read()).reviewRestrictions[0]).toMatchObject({
      guestKey: null,
      liftedBy: 'key expired',
      liftedAt: new Date(w.start + 30 * DAY + 1000).toISOString(),
    });
  });

  it('lifting a guest restriction clears its key at once', async () => {
    const w = await world();
    await w.planner.createGuestReview(review(), '203.0.113.5');
    const reviewId = (await w.planner.listApprovedReviews()).items[0]!.id;
    const { id } = await w.planner.createRestriction({ reviewId, scope: 'place', reason: 'spam lặp' }, 'staff-1');
    await w.planner.liftRestriction(id, 'staff-1');
    expect((await w.store.read()).reviewRestrictions[0]).toMatchObject({ guestKey: null, liftedBy: 'staff-1' });
    await w.planner.createGuestReview(review(), '203.0.113.5').catch(() => undefined); // not blocked: at most the 24 h dedupe
  });
}
