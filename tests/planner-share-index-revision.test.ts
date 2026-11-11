import { describe, expect, it } from 'vitest';
import { PlannerRepository } from '../src/server/planner/repository';
import { createMemoryPlannerStore, type PlannerStore } from '../src/server/planner/store';
import { activityInput, daLatTripInput, fakeCatalog } from './planner-helpers';

/**
 * The share-token index is per repository, so with two replicas on one
 * database a link created or revoked on one must be honoured by the other. The
 * seam is the store's optional `revision()`; this fakes a shared store with a
 * counter, offline. The Postgres version is in the integration suite.
 */
function sharedStore() {
  const inner = createMemoryPlannerStore();
  let revision = 0;
  let tableReads = 0;
  const store: PlannerStore = {
    read() {
      tableReads += 1;
      return inner.read();
    },
    write: (next) => inner.write(next),
    async transact(mutate) {
      const result = await inner.transact(mutate);
      revision += 1;
      return result;
    },
    async revision() {
      return revision;
    },
  };
  return { store, reads: () => tableReads };
}

const replica = (store: PlannerStore) =>
  new PlannerRepository({
    store,
    catalog: fakeCatalog(),
    scryptCostLog2: 10,
    newId: (prefix) => `${prefix}_${Math.random().toString(16).slice(2, 10)}`,
  });

describe('share index across replicas', () => {
  it('resolves a link created on another replica, and stops when it is revoked there', async () => {
    const { store } = sharedStore();
    const a = replica(store);
    const b = replica(store);
    const { user } = await a.createUser({ handle: 'hung-tran', displayName: 'Hưng' });
    const created = await a.createTrip(user.id, daLatTripInput());
    await a.addActivity(user.id, created.trip.id, activityInput(), created.trip.version);

    // B builds an index while nothing is shared.
    expect(await b.getSharedTrip('x'.repeat(43))).toBeNull();

    const { shareToken } = await a.setVisibility(user.id, created.trip.id, 'unlisted');
    expect(await b.getSharedTrip(shareToken!)).not.toBeNull();

    await a.revokeShare(user.id, created.trip.id);
    expect(await b.getSharedTrip(shareToken!)).toBeNull();
  });

  it('reuses the index while the revision is unchanged', async () => {
    const { store, reads } = sharedStore();
    const a = replica(store);
    await a.getSharedTrip('x'.repeat(43));
    const built = reads();
    await a.getSharedTrip('y'.repeat(43));
    expect(reads()).toBe(built);
  });
});
