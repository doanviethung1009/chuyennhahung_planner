import { readFile } from 'node:fs/promises';
import { getRepository } from '@/server/content/instance';
import { createContentCatalog } from '@/server/planner/catalog';
import { importPlannerDocument } from '@/server/persistence/planner-transfer';
import { createPostgresPlannerStore } from '@/server/persistence/postgres-planner-store';
import { createPostgresPool } from '@/server/persistence/postgres-pool';

const file = process.argv[2];
const url = process.env.DATABASE_URL;
if (!file || !url) {
  console.error('usage: DATABASE_URL=... npm run planner:import -- <planner.json>');
  process.exit(1);
}

// Parsed before the pool opens, with a fixed message: a SyntaxError can quote
// file content, and the file holds password hashes and token digests.
let document: unknown;
try {
  document = JSON.parse(await readFile(file, 'utf8')) as unknown;
} catch (error) {
  const missing = (error as { code?: unknown }).code === 'ENOENT';
  console.error(`import failed: ${missing ? 'file not found' : 'file is not valid JSON'}`);
  process.exit(1);
}

const pool = createPostgresPool(url, { max: 1 });
try {
  const summary = await importPlannerDocument(
    createPostgresPlannerStore(pool),
    document,
    // Places and destinations are checked against the real content catalog.
    { catalog: createContentCatalog(await getRepository()) },
  );
  console.log(`imported ${summary.rows} row(s):`, summary.collections);
  if (summary.droppedExpired > 0) {
    console.log(`left behind ${summary.droppedExpired} expired session/sign-in row(s)`);
  }
} catch (error) {
  console.error(`import failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  const issues = (error as { issues?: { path: string; message: string }[] }).issues ?? [];
  for (const issue of issues) console.error(`  ${issue.path}: ${issue.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
