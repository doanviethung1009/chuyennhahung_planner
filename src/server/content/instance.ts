import { seedTravelContent } from '@/content/travel/seed';
import { TravelContentRepository } from './repository';
import { createJsonFileStore } from './store';

/**
 * The process-wide repository used by route handlers.
 *
 * Persistence is a JSON file under `.data/` (gitignored). On first use, an
 * empty store is seeded with the demo content so a fresh clone has something to
 * read — set `TRAVEL_CONTENT_AUTOSEED=false` to opt out. There is no migration
 * step in this phase; see `docs/adr/0001-travel-content-system.md`.
 */
const DEFAULT_STORE_PATH = '.data/travel-content.json';

let instance: Promise<TravelContentRepository> | null = null;

async function build(): Promise<TravelContentRepository> {
  const storePath = process.env.TRAVEL_CONTENT_STORE?.trim() || DEFAULT_STORE_PATH;
  const repository = new TravelContentRepository({
    store: createJsonFileStore(storePath),
  });

  if (process.env.TRAVEL_CONTENT_AUTOSEED !== 'false') {
    await seedTravelContent(repository);
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
