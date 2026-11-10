import { chmod, writeFile } from 'node:fs/promises';
import { exportPlannerDocument } from '@/server/persistence/planner-transfer';
import { createPostgresPlannerStore } from '@/server/persistence/postgres-planner-store';
import { createPostgresPool } from '@/server/persistence/postgres-pool';

const file = process.argv[2];
const url = process.env.DATABASE_URL;
if (!file || !url) {
  console.error('usage: DATABASE_URL=... npm run planner:export -- <planner.json>');
  process.exit(1);
}

const pool = createPostgresPool(url, { max: 1 });
try {
  const body = await exportPlannerDocument(createPostgresPlannerStore(pool));
  // The file holds password hashes and token digests: owner-only. `mode` only
  // applies when the file is created, so an overwritten file is chmod-ed too.
  await writeFile(file, body, { encoding: 'utf8', mode: 0o600 });
  await chmod(file, 0o600);
  console.log(`exported to ${file}`);
} catch (error) {
  console.error(`export failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
