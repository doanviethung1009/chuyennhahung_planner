import { seedStaticStories } from '@/content/travel/static-stories';
import { TravelContentRepository } from '@/server/content/repository';
import { createJsonFileStore } from '@/server/content/store';

// Adds the seven typed-seed stories (src/content/stories.ts) to an EXISTING content
// store (ADR 0012 decision 7). Create-only per slug: a slug already in the store is
// skipped and never updated, so a CMS edit is never overwritten. Not run on boot.
// Note: running it after deleting a seeded story recreates that story.
// Uses the same store path as the app (TRAVEL_CONTENT_STORE, else .data/travel-content.json)
// and does not auto-seed the demo content. `--dry-run` writes nothing.
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const unknown = args.filter((arg) => arg !== '--dry-run');
if (unknown.length > 0) {
  console.error(`unknown argument: ${unknown.join(' ')}\nusage: npm run content:seed-static [-- --dry-run]`);
  process.exit(1);
}

const storePath = process.env.TRAVEL_CONTENT_STORE?.trim() || '.data/travel-content.json';

try {
  const repository = new TravelContentRepository({ store: createJsonFileStore(storePath) });
  const result = await seedStaticStories(repository, { dryRun });
  console.log(`${dryRun ? 'dry run, nothing written' : 'done'} (store: ${storePath})`);
  console.log(`  ${dryRun ? 'would create' : 'created'} (${result.created.length}): ${result.created.join(', ') || '-'}`);
  console.log(`  skipped, already present (${result.skipped.length}): ${result.skipped.join(', ') || '-'}`);
  process.exit(0);
} catch (error) {
  console.error(`content:seed-static failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}
