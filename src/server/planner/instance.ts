import type pg from 'pg';
import { getRepository } from '@/server/content/instance';
import { createContentCatalog } from './catalog';
import { PlannerRepository } from './repository';
import { migrateOnStartup } from '@/server/persistence/migrate';
import { createPostgresPlannerStore } from '@/server/persistence/postgres-planner-store';
import { createPostgresPool } from '@/server/persistence/postgres-pool';
import { createPostgresRateLimiter } from '@/server/persistence/postgres-rate-limiter';
import {
  asAsyncLimiter,
  createRateLimiter,
  WRITE_LIMITS,
  type AsyncRateLimiter,
  type WriteLimitName,
} from '@/server/rate-limit';
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

interface Selected {
  store: PlannerStore;
  /** The Planner's pool, or null on the JSON store; the write limiters share it. */
  pool: pg.Pool | null;
  databaseUrl: string | null;
}

async function selectStore(): Promise<Selected> {
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
    return { store: createPostgresPlannerStore(pool), pool, databaseUrl };
  }
  return {
    store: createJsonPlannerStore(process.env.PLANNER_STORE?.trim() || DEFAULT_STORE_PATH),
    pool: null,
    databaseUrl: null,
  };
}

export type WriteLimiters = Record<WriteLimitName, AsyncRateLimiter>;

interface Built {
  repository: PlannerRepository;
  limiters: WriteLimiters;
}

/**
 * Write limiters follow the store (ADR 0019 §3): PostgreSQL counters, shared by
 * every instance, when the Planner is on PostgreSQL; otherwise in-process
 * limiters wrapped to the async interface. A configured database never falls
 * back to in-process counters — a check that cannot reach it fails closed.
 */
function buildLimiters(databaseUrl: string | null): WriteLimiters {
  // Their own small pool with a statement timeout: every anonymous guest POST
  // makes one query, and that must not be able to hold the store's connections
  // (max 5) or hang on a stuck query. A slow database is then a fast 503.
  const pool = databaseUrl
    ? createPostgresPool(databaseUrl, { max: 2, options: '-c statement_timeout=3000' })
    : null;
  const make = (spec: (typeof WRITE_LIMITS)[WriteLimitName]): AsyncRateLimiter =>
    pool
      ? createPostgresRateLimiter({ pool, ...spec })
      : asAsyncLimiter(createRateLimiter({ limit: spec.limit, windowMs: spec.windowMs }));
  return { plannerReview: make(WRITE_LIMITS.plannerReview), guestReview: make(WRITE_LIMITS.guestReview),
    report: make(WRITE_LIMITS.report), memberMapShare: make(WRITE_LIMITS.memberMapShare),
  };
}

let instance: Promise<Built> | null = null;
/**
 * After a failed build, requests within this window get the same failure
 * instead of each opening a pool and retrying the migration — a down database
 * must not be hammered by every incoming request.
 */
export const PLANNER_RETRY_BACKOFF_MS = 5_000;
let lastFailure: { at: number; error: unknown } | null = null;

async function build(): Promise<Built> {
  const content = await getRepository();
  const { store, databaseUrl } = await selectStore();

  return {
    repository: new PlannerRepository({ store, catalog: createContentCatalog(content) }),
    limiters: buildLimiters(databaseUrl),
  };
}

function getBuilt(): Promise<Built> {
  // Cached as a promise so concurrent first requests share one build rather
  // than racing to open the same file.
  if (!instance && lastFailure && Date.now() - lastFailure.at < PLANNER_RETRY_BACKOFF_MS) {
    return Promise.reject(lastFailure.error);
  }
  instance ??= build().then(
    (built) => {
      lastFailure = null;
      return built;
    },
    (error: unknown) => {
      instance = null;
      lastFailure = { at: Date.now(), error };
      throw error;
    },
  );
  return instance;
}

export async function getPlannerRepository(): Promise<PlannerRepository> {
  return (await getBuilt()).repository;
}

/** The review write limiters, built with the repository (same database, same failure handling). */
export async function getWriteLimiters(): Promise<WriteLimiters> {
  return (await getBuilt()).limiters;
}
