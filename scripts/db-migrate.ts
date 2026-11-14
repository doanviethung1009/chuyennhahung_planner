import { resolve } from 'node:path';
import { readMigrationFiles, runMigrations } from '@/server/persistence/migrate';
import { createPostgresPool } from '@/server/persistence/postgres-pool';

// One migration set (`db/migrations`), applied to every database that has a URL:
// the Planner's (ADR 0009) and Travel Content's (ADR 0013). When both point at
// the same database the second run finds everything applied.
const targets = [
  ['PLANNER_DATABASE_URL', process.env.PLANNER_DATABASE_URL?.trim()],
  ['CONTENT_DATABASE_URL', process.env.CONTENT_DATABASE_URL?.trim()],
].filter((target): target is [string, string] => Boolean(target[1]));

if (targets.length === 0) {
  console.error('Neither PLANNER_DATABASE_URL nor CONTENT_DATABASE_URL is set.');
  process.exit(1);
}

const files = await readMigrationFiles(resolve('db/migrations'));
for (const [name, url] of targets) {
  const pool = createPostgresPool(url, { max: 1 });
  try {
    const report = await runMigrations(pool, files);
    console.log(`${name}`);
    console.log(`  applied: ${report.applied.join(', ') || '(none)'}`);
    console.log(`  already applied: ${report.skipped.join(', ') || '(none)'}`);
  } catch (error) {
    // The message of a migration failure is SQL text or a constraint name, never
    // the connection string; the driver's own connect errors carry no secrets.
    console.error(`${name}: migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
