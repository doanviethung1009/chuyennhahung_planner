import { getRepository } from '@/server/content/instance';
import { createContentCatalog } from './catalog';
import { PlannerRepository } from './repository';
import { createPostgresPlannerStore } from '@/server/persistence/postgres-planner-store';
import { createPostgresPool } from '@/server/persistence/postgres-pool';
import { createJsonPlannerStore, type PlannerStore } from './store';

/**
 * The process-wide Planner repository used by route handlers.
 *
 * Persistence is a JSON file under `.data/` (gitignored), separate from the
 * content store: traveller data and editorial content have different privacy
 * and retention profiles, and one file would mean one lock and one blast radius
 * for both. Override the path with `PLANNER_STORE`.
 *
 * There is **no seed**. A seeded demo trip would be a trip owned by nobody, and
 * the one invariant that matters here is that every trip has an owner. The
 * Đà Lạt demo lives in the tests instead (`tests/planner-acceptance.test.ts`).
 */
const DEFAULT_STORE_PATH = '.data/planner.json';

function selectStore(): PlannerStore {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    // The pool connects lazily, so an unreachable database is reported per
    // request as a 503 rather than failing the build of this singleton.
    return createPostgresPlannerStore(createPostgresPool(databaseUrl));
  }
  return createJsonPlannerStore(process.env.PLANNER_STORE?.trim() || DEFAULT_STORE_PATH);
}

let instance: Promise<PlannerRepository> | null = null;

async function build(): Promise<PlannerRepository> {
  const content = await getRepository();

  return new PlannerRepository({
    store: selectStore(),
    catalog: createContentCatalog(content),
  });
}

export function getPlannerRepository(): Promise<PlannerRepository> {
  // Cached as a promise so concurrent first requests share one build rather
  // than racing to open the same file.
  instance ??= build().catch((error: unknown) => {
    instance = null;
    throw error;
  });
  return instance;
}
