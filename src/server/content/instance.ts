import { seedTravelContent } from '@/content/travel/seed';
import { migrateOnStartup } from '@/server/persistence/migrate';
import { createPostgresContentStore } from '@/server/persistence/postgres-content-store';
import { translateDatabaseError } from '@/server/persistence/postgres-planner-store';
import { createPostgresPool } from '@/server/persistence/postgres-pool';
import { TravelContentRepository } from './repository';
import { createJsonFileStore, type ContentStore } from './store';

/**
 * The process-wide repository used by route handlers.
 *
 * Persistence is PostgreSQL when `CONTENT_DATABASE_URL` is set (ADR 0013), and
 * then **never** a fallback to the file: an outage is a 503, not stale content.
 * Without it, a JSON file under `.data/` (gitignored), as before — development
 * and tests. On first use an empty store is seeded with the demo content so a
 * fresh clone has something to read; set `TRAVEL_CONTENT_AUTOSEED=false` to opt
 * out (production, once the real content is imported).
 */
const DEFAULT_STORE_PATH = '.data/travel-content.json';

/** Held while seeding, so replicas that start together seed once. */
const SEED_LOCK_KEY = '8008004';

interface Selected {
  store: ContentStore;
  /** Runs `task` while holding the cross-process seed lock. Absent for the file. */
  withSeedLock?: <R>(task: () => Promise<R>) => Promise<R>;
}

async function selectStore(): Promise<Selected> {
  const databaseUrl = process.env.CONTENT_DATABASE_URL?.trim();
  if (databaseUrl) {
    // Migrations run before the first request is served (ADR 0008 §7), under a
    // session advisory lock. A failure is a 503 with no driver detail and the
    // instance cache resets, so the next request retries.
    const pool = createPostgresPool(databaseUrl);
    try {
      await migrateOnStartup(pool, undefined, 'Travel Content');
    } catch (error) {
      await pool.end().catch(() => undefined);
      throw error;
    }
    return {
      store: createPostgresContentStore(pool),
      async withSeedLock(task) {
        let client;
        try {
          client = await pool.connect();
        } catch (error) {
          throw translateDatabaseError(error, 'Travel Content');
        }
        let held = false;
        let broken = false;
        try {
          try {
            await client.query('SELECT pg_advisory_lock($1)', [SEED_LOCK_KEY]);
            held = true;
          } catch (error) {
            broken = true;
            throw translateDatabaseError(error, 'Travel Content');
          }
          return await task();
        } finally {
          if (held) {
            await client
              .query('SELECT pg_advisory_unlock($1)', [SEED_LOCK_KEY])
              .catch(() => (broken = true));
          }
          // A session lock must never go back into the pool held: a connection
          // whose unlock failed is destroyed, which frees the lock.
          client.release(broken);
        }
      },
    };
  }
  return { store: createJsonFileStore(process.env.TRAVEL_CONTENT_STORE?.trim() || DEFAULT_STORE_PATH) };
}

let instance: Promise<TravelContentRepository> | null = null;

async function build(): Promise<TravelContentRepository> {
  const { store, withSeedLock } = await selectStore();
  const repository = new TravelContentRepository({ store });

  if (process.env.TRAVEL_CONTENT_AUTOSEED !== 'false') {
    const seed = () => seedTravelContent(repository);
    await (withSeedLock ? withSeedLock(seed) : seed());
  }

  return repository;
}

export function getRepository(): Promise<TravelContentRepository> {
  // Cached as a promise, so concurrent first requests share one seed pass
  // rather than racing to write the same records.
  instance ??= build().catch((error: unknown) => {
    instance = null;
    throw error;
  });
  return instance;
}
