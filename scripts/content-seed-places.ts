import { seedLandmarkPlaces } from '@/content/travel/seed-places';
import { TravelContentRepository } from '@/server/content/repository';
import { createJsonFileStore } from '@/server/content/store';
import { migrateOnStartup } from '@/server/persistence/migrate';
import { createPostgresContentStore } from '@/server/persistence/postgres-content-store';
import { createPostgresPool } from '@/server/persistence/postgres-pool';

// Adds the landmark places (src/content/travel/seed-places.ts) to an EXISTING content
// store. Create-only per slug: a slug already in the store is
// skipped and never updated, so a CMS edit is never overwritten. Not run on boot.
// Note: running it after deleting a seeded place recreates that place.
// Uses the same store path as the app (TRAVEL_CONTENT_STORE, else .data/travel-content.json)
// and does not auto-seed the demo content. `--dry-run` writes nothing.
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const unknown = args.filter((arg) => arg !== '--dry-run');
if (unknown.length > 0) {
  console.error(`unknown argument: ${unknown.join(' ')}\nusage: npm run content:seed-places [-- --dry-run]`);
  process.exit(1);
}

const storePath = process.env.TRAVEL_CONTENT_STORE?.trim() || '.data/travel-content.json';
// With CONTENT_DATABASE_URL set the app reads PostgreSQL, so this tops up that
// store instead of the file (ADR 0013).
const databaseUrl = process.env.CONTENT_DATABASE_URL?.trim();
const pool = databaseUrl ? createPostgresPool(databaseUrl, { max: 1 }) : null;

try {
  if (pool) await migrateOnStartup(pool, undefined, 'Travel Content');
  const repository = new TravelContentRepository({
    store: pool ? createPostgresContentStore(pool) : createJsonFileStore(storePath),
  });
  const result = await seedLandmarkPlaces(repository, { dryRun });
  console.log(
    `${dryRun ? 'dry run, nothing written' : 'done'} (store: ${pool ? 'PostgreSQL' : storePath})`,
  );
  console.log(`  ${dryRun ? 'would create' : 'created'} (${result.created.length}): ${result.created.join(', ') || '-'}`);
  console.log(`  skipped, already present (${result.skipped.length}): ${result.skipped.join(', ') || '-'}`);
  await pool?.end();
  process.exit(0);
} catch (error) {
  console.error(`content:seed-static failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  await pool?.end().catch(() => undefined);
  process.exit(1);
}
