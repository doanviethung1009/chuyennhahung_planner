import { describe, expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import { listingDecisionSchema, listingRequestSchema } from '../src/server/planner/schemas';
import { activityInput, daLatTripInput, makeOwner, makePlanner } from './planner-helpers';

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

/** A public trip, with the owner's listing request already sent. */
async function listedTrip(authorDisplay: 'name' | 'anonymous' = 'name') {
  const planner = makePlanner();
  const { userId } = await makeOwner(planner);
  const view = await planner.createTrip(userId, daLatTripInput({ title: 'Đà Lạt ba ngày' }));
  await planner.addActivity(userId, view.trip.id, activityInput(), null);
  await planner.setVisibility(userId, view.trip.id, 'public');
  await planner.requestListing(userId, view.trip.id, authorDisplay);
  return { planner, userId, tripId: view.trip.id };
}

describe('community listing lifecycle (ADR 0014)', () => {
  it('shows nothing until staff approve', async () => {
    const { planner, tripId } = await listedTrip();
    expect(await planner.listCommunityTrips()).toEqual([]);

    await planner.decideListing(tripId, 'approve', 'staff-1', null);
    const [card] = await planner.listCommunityTrips();
    expect(card?.title).toBe('Đà Lạt ba ngày');
  });

  it('only a public, active trip can be submitted', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const view = await planner.createTrip(userId, daLatTripInput());
    await expectCode(planner.requestListing(userId, view.trip.id, 'name'), 'invalid_state');
    await planner.setVisibility(userId, view.trip.id, 'unlisted');
    await expectCode(planner.requestListing(userId, view.trip.id, 'name'), 'invalid_state');
  });

  it('keeps unlisted, pending and rejected trips off the gallery', async () => {
    const { planner, tripId } = await listedTrip();
    await planner.decideListing(tripId, 'reject', 'staff-1', 'không phù hợp');
    expect(await planner.listCommunityTrips()).toEqual([]);
    const [item] = await planner.listListingQueue();
    expect(item?.listing).toMatchObject({ status: 'rejected', rejectReason: 'không phù hợp' });
  });

  it('sends an approved listing back to pending on any edit', async () => {
    const { planner, userId, tripId } = await listedTrip();
    await planner.decideListing(tripId, 'approve', 'staff-1', null);
    const before = await planner.getTrip(userId, tripId);

    await planner.updateTrip(userId, tripId, { note: 'đổi ghi chú' }, before.trip.version);

    expect(await planner.listCommunityTrips()).toEqual([]);
    const [item] = await planner.listListingQueue();
    expect(item?.listing).toMatchObject({ status: 'pending', decidedAt: null, decidedBy: null });
  });

  it('ends the listing when the trip leaves public or is archived', async () => {
    const a = await listedTrip();
    await a.planner.decideListing(a.tripId, 'approve', 's', null);
    await a.planner.setVisibility(a.userId, a.tripId, 'unlisted');
    expect(await a.planner.listCommunityTrips()).toEqual([]);
    expect(await a.planner.listListingQueue()).toEqual([]);

    const b = await listedTrip();
    await b.planner.decideListing(b.tripId, 'approve', 's', null);
    const view = await b.planner.getTrip(b.userId, b.tripId);
    await b.planner.archiveTrip(b.userId, b.tripId, view.trip.version);
    expect(await b.planner.listCommunityTrips()).toEqual([]);
  });

  it('keeps the listing when the share token is rotated, and follows the new token', async () => {
    const { planner, userId, tripId } = await listedTrip();
    await planner.decideListing(tripId, 'approve', 's', null);
    const rotated = await planner.rotateShareToken(userId, tripId);
    const [card] = await planner.listCommunityTrips();
    expect(card?.shareToken).toBe(rotated.shareToken);
  });

  it('lets staff remove an approved listing and the owner withdraw', async () => {
    const { planner, userId, tripId } = await listedTrip();
    await expectCode(planner.decideListing(tripId, 'remove', 's', 'lý do'), 'invalid_state');
    await planner.decideListing(tripId, 'approve', 's', null);
    await expectCode(planner.decideListing(tripId, 'approve', 's', null), 'invalid_state');
    await planner.decideListing(tripId, 'remove', 's', 'vi phạm');
    expect(await planner.listCommunityTrips()).toEqual([]);

    await planner.withdrawListing(userId, tripId);
    expect(await planner.listListingQueue()).toEqual([]);
  });

  it("does not let one owner list another owner's trip", async () => {
    const { planner, tripId } = await listedTrip();
    const other = await makeOwner(planner, 'khac');
    await expectCode(planner.requestListing(other.userId, tripId, 'name'), 'not_found');
  });
});

describe('community card projection', () => {
  it('names exactly the allowed fields', async () => {
    const { planner, tripId } = await listedTrip();
    await planner.decideListing(tripId, 'approve', 's', null);
    const [card] = await planner.listCommunityTrips();
    expect(Object.keys(card ?? {}).sort()).toEqual(
      [
        'activityCount',
        'approvedAt',
        'author',
        'destinationSlug',
        'durationDays',
        'partySize',
        'shareToken',
        'title',
        'travelStyle',
      ].sort(),
    );
  });

  it('shows the display name only when the owner chose it', async () => {
    const named = await listedTrip('name');
    await named.planner.decideListing(named.tripId, 'approve', 's', null);
    expect((await named.planner.listCommunityTrips())[0]?.author).toBe('Hưng Trần');

    const anon = await listedTrip('anonymous');
    await anon.planner.decideListing(anon.tripId, 'approve', 's', null);
    const [card] = await anon.planner.listCommunityTrips();
    expect(card?.author).toBeNull();
    const text = JSON.stringify(card);
    expect(text).not.toContain('Hưng');
    expect(text).not.toContain(anon.userId);
    expect(text).not.toContain(anon.tripId);
  });
});

describe('listing request schemas', () => {
  it('rejects status, token and unknown fields from the owner', () => {
    expect(listingRequestSchema.safeParse({ authorDisplay: 'name' }).success).toBe(true);
    expect(listingRequestSchema.safeParse({ authorDisplay: 'name', status: 'approved' }).success).toBe(false);
    expect(listingRequestSchema.safeParse({ authorDisplay: 'x' }).success).toBe(false);
  });

  it('requires a reason to reject or remove, not to approve', () => {
    expect(listingDecisionSchema.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(listingDecisionSchema.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(listingDecisionSchema.safeParse({ decision: 'remove', reason: 'vi phạm' }).success).toBe(true);
  });
});
