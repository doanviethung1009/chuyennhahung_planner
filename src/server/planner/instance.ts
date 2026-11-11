import { getRepository } from '@/server/content/instance';
import { createContentCatalog } from './catalog';
import { PlannerRepository } from './repository';
import { migrateOnStartup } from '@/server/persistence/migrate';
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

async function selectStore(): Promise<PlannerStore> {
  const databaseUrl = process.env.PLANNER_DATABASE_URL?.trim();
  if (!databaseUrl && process.env.DATABASE_URL?.trim()) {
    // The old name (ADR 0009 before it was reconciled with ADR 0008). Without
    // this, a deploy that still sets it would run on the JSON file silently.
    console.warn(
      '[planner] DATABASE_URL is set but ignored: the Planner reads PLANNER_DATABASE_URL; using the JSON store',
    );
  }
  if (databaseUrl) {
    // The pool connects lazily, but migrations run here, before the first
    // request is served (ADR 0008 §7): under a session advisory lock, so
    // replicas starting together apply each file once. A failure is a 503 with
    // no driver detail and the instance cache resets, so the next request
    // retries. The app never falls back to the JSON file.
    const pool = createPostgresPool(databaseUrl);
    try {
      await migrateOnStartup(pool);
    } catch (error) {
      // The next request builds a new pool; do not leak this one meanwhile.
      await pool.end().catch(() => undefined);
      throw error;
    }
    return createPostgresPlannerStore(pool);
  }
  return createJsonPlannerStore(process.env.PLANNER_STORE?.trim() || DEFAULT_STORE_PATH);
}

let instance: Promise<PlannerRepository> | null = null;
/**
 * After a failed build, requests within this window get the same failure
 * instead of each opening a pool and retrying the migration — a down database
 * must not be hammered by every incoming request.
 */
export const PLANNER_RETRY_BACKOFF_MS = 5_000;
let lastFailure: { at: number; error: unknown } | null = null;

async function build(): Promise<PlannerRepository> {
  const content = await getRepository();

  return new PlannerRepository({
    store: await selectStore(),
    catalog: createContentCatalog(content),
  });
}

export function getPlannerRepository(): Promise<PlannerRepository> {
  // Cached as a promise so concurrent first requests share one build rather
  // than racing to open the same file.
  if (!instance && lastFailure && Date.now() - lastFailure.at < PLANNER_RETRY_BACKOFF_MS) {
    return Promise.reject(lastFailure.error);
  }
  instance ??= build().then(
    (repository) => {
      lastFailure = null;
      return repository;
    },
    (error: unknown) => {
      instance = null;
      lastFailure = { at: Date.now(), error };
      throw error;
    },
  );
  return instance;
}
