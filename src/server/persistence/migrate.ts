import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ContentError } from '@/server/content/errors';
import type { PgPoolLike } from './postgres-planner-store';

/**
 * The migration runner (ADR 0009 §4): numbered plain-SQL files applied in
 * order, each in its own transaction together with its `schema_migrations`
 * row. They run at startup, on the store's first use (ADR 0008 §7), and by hand
 * with `npm run db:migrate`: the same code. A *session* advisory lock held for
 * the whole run — including the `schema_migrations` bootstrap — makes replicas
 * that start together apply each file once.
 */

export const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_KEY = '8008002';
/**
 * How long a runner waits for another runner's lock before giving up. Without
 * it, a replica whose migration hangs would hang the other replica's first
 * request — and every request queued behind it — indefinitely.
 */
export const MIGRATION_LOCK_TIMEOUT = '30s';

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationReport {
  applied: string[];
  skipped: string[];
}

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export async function readMigrationFiles(directory: string): Promise<MigrationFile[]> {
  const names = (await readdir(directory)).filter((name) => MIGRATION_FILE.test(name)).sort();
  const files: MigrationFile[] = [];
  for (const name of names) {
    const sql = await readFile(join(directory, name), 'utf8');
    files.push({ name, sql, checksum: checksumOf(sql) });
  }
  return files;
}

export async function runMigrations(
  pool: PgPoolLike,
  files: MigrationFile[],
  lockTimeout: string = MIGRATION_LOCK_TIMEOUT,
): Promise<MigrationReport> {
  const report: MigrationReport = { applied: [], skipped: [] };
  const client = await pool.connect();
  let broken = false;
  let locked = false;
  try {
    // Everything, the bootstrap too, happens under the lock: two runners
    // racing `CREATE TABLE IF NOT EXISTS` can still collide on the catalogue.
    // Bounded wait (SQLSTATE 55P03 on expiry), then reset: this connection goes
    // back to the pool, and the store's own lock waits must not inherit it.
    await client.query(`SELECT set_config('lock_timeout', $1, false)`, [lockTimeout]);
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    locked = true;
    await client.query('RESET lock_timeout');
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         checksum text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    for (const file of files) {
      await client.query('BEGIN');
      try {
        const existing = await client.query(
          'SELECT checksum FROM schema_migrations WHERE name = $1',
          [file.name],
        );
        const recorded = existing.rows[0]?.checksum;
        if (recorded !== undefined) {
          if (recorded !== file.checksum) {
            throw new Error(
              `migration ${file.name} was edited after it was applied — add a new migration instead`,
            );
          }
          await client.query('ROLLBACK');
          report.skipped.push(file.name);
          continue;
        }
        await client.query(file.sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          file.name,
          file.checksum,
        ]);
        await client.query('COMMIT');
        report.applied.push(file.name);
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          broken = true;
        }
        throw error;
      }
    }
    return report;
  } catch (error) {
    // A connection that failed mid-run is destroyed below, which also frees
    // the session lock.
    if (!locked) broken = true;
    throw error;
  } finally {
    if (locked && !broken) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      } catch {
        // A session lock must never go back into the pool held.
        broken = true;
      }
    }
    client.release(broken);
  }
}

/**
 * Startup migration for the app (ADR 0008 §7). Any failure — the database
 * unreachable, a bad file, an edited one — becomes a 503 with no driver detail;
 * the instance cache resets on rejection, so the next request tries again.
 * `npm run db:migrate` shows the real message.
 */
export async function migrateOnStartup(
  pool: PgPoolLike,
  directory: string = resolve(process.cwd(), 'db/migrations'),
  /** `Planner` or `Travel Content`: only the wording of the log and the 503. */
  label = 'Planner',
): Promise<MigrationReport> {
  try {
    return await runMigrations(pool, await readMigrationFiles(directory));
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : 'unknown';
    // The code only: a driver message can carry a host or a fragment of SQL.
    console.error(
      `[${label.toLowerCase()}] startup migration failed (${code}); run "npm run db:migrate" for detail`,
    );
    throw new ContentError('service_unavailable', `the ${label} database is unavailable`);
  }
}
