import { describe, expect, it } from 'vitest';
import { resolveMemberMapSharePreview } from '../src/server/planner/member-map-share-preview';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import type { PlannerRepository } from '../src/server/planner/repository';
import { daLatTripInput, makeOwner, makePlanner } from './planner-helpers';

/** ADR 0030 slice 2c: the preview is the public projection, for the signed-in member only. */

const KNOWN = new Set(['da-lat', 'moc-chau', 'moc-chau']);

async function session(planner: PlannerRepository, handle: string) {
  const { userId, token } = await makeOwner(planner, handle);
  return { userId, cookie: (await planner.signIn(token)).token };
}

async function complete(planner: PlannerRepository, userId: string, destinationSlug: string) {
  const made = await planner.createTrip(userId, daLatTripInput({ destinationSlug }));
  await planner.updateTrip(userId, made.trip.id, { planningStatus: 'completed' }, made.trip.version);
}

describe('resolveMemberMapSharePreview', () => {
  it('is null for a guest or a malformed cookie, without touching the store', async () => {
    let reads = 0;
    const spy = new Proxy({} as PlannerRepository, {
      get: () => () => {
        reads += 1;
        throw new Error('store touched');
      },
    });
    for (const cookie of [null, '', 'garbage!', 'short']) {
      expect(await resolveMemberMapSharePreview(spy, cookie, KNOWN)).toBeNull();
    }
    expect(reads).toBe(0);
  });

  it('shows visited places only, in buckets, with no planned place and no extra field', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const me = await session(planner, 'nguoi-di');
    await complete(planner, me.userId, 'da-lat');
    await planner.createTrip(me.userId, daLatTripInput({ destinationSlug: 'moc-chau' })); // planned only
    const points = await resolveMemberMapSharePreview(planner, me.cookie, KNOWN);
    expect(points).toEqual([{ slug: 'da-lat', visitsBucket: 1 }]);
    expect(JSON.stringify(points)).not.toContain('moc-chau');
    expect(Object.keys(points![0]!).sort()).toEqual(['slug', 'visitsBucket']);
  });

  it('is empty (not null) for a member with no completed trip, and never shows another member’s places', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const a = await session(planner, 'a-thanh');
    const b = await session(planner, 'b-lan');
    await complete(planner, a.userId, 'moc-chau');
    expect(await resolveMemberMapSharePreview(planner, b.cookie, KNOWN)).toEqual([]);
    expect(await resolveMemberMapSharePreview(planner, a.cookie, KNOWN)).toEqual([{ slug: 'moc-chau', visitsBucket: 1 }]);
  });

  it('is null while a password change is pending', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const { temporaryPassword } = await planner.createUser({ handle: 'tam', displayName: 'Tâm', email: 'tam@example.com' });
    const signed = await planner.signInWithPassword('tam@example.com', temporaryPassword!);
    expect(await resolveMemberMapSharePreview(planner, signed.token, KNOWN)).toBeNull();
  });
});
