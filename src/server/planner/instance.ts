import { getRepository } from '@/server/content/instance';
import { createContentCatalog } from './catalog';
import { PlannerRepository } from './repository';
import { createJsonPlannerStore } from './store';

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

let instance: Promise<PlannerRepository> | null = null;

async function build(): Promise<PlannerRepository> {
  const storePath = process.env.PLANNER_STORE?.trim() || DEFAULT_STORE_PATH;
  const content = await getRepository();

  return new PlannerRepository({
    store: createJsonPlannerStore(storePath),
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
