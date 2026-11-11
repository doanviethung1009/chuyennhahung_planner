import { resolve } from 'node:path';
import { readMigrationFiles, runMigrations } from '@/server/persistence/migrate';
import { createPostgresPool } from '@/server/persistence/postgres-pool';

const url = process.env.PLANNER_DATABASE_URL;
if (!url) {
  console.error('PLANNER_DATABASE_URL is not set.');
  process.exit(1);
}

const pool = createPostgresPool(url, { max: 1 });
try {
  const files = await readMigrationFiles(resolve('db/migrations'));
  const report = await runMigrations(pool, files);
  console.log(`applied: ${report.applied.join(', ') || '(none)'}`);
  console.log(`already applied: ${report.skipped.join(', ') || '(none)'}`);
} catch (error) {
  // The message of a migration failure is SQL text or a constraint name, never
  // the connection string; the driver's own connect errors carry no secrets.
  console.error(`migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
