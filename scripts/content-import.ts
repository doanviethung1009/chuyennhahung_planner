import { readFile } from 'node:fs/promises';
import { importContentDocument } from '@/server/persistence/content-transfer';
import { migrateOnStartup } from '@/server/persistence/migrate';
import { createPostgresContentStore } from '@/server/persistence/postgres-content-store';
import { createPostgresPool } from '@/server/persistence/postgres-pool';

const file = process.argv[2];
const url = process.env.CONTENT_DATABASE_URL;
if (!file || !url) {
  console.error('usage: CONTENT_DATABASE_URL=... npm run content:import -- <travel-content.json>');
  process.exit(1);
}

// Parsed before the pool opens, with a fixed message: a SyntaxError can quote
// the file, and it holds the site's unpublished drafts.
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
  // The tables must exist; the app does the same at startup.
  await migrateOnStartup(pool, undefined, 'Travel Content');
  const summary = await importContentDocument(createPostgresContentStore(pool), document);
  console.log(`imported ${summary.rows} row(s):`, summary.collections);
} catch (error) {
  console.error(`import failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  const issues = (error as { issues?: { path: string; message: string }[] }).issues ?? [];
  for (const issue of issues) console.error(`  ${issue.path}: ${issue.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
