import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PgPoolLike } from './postgres-planner-store';

/**
 * The migration runner (ADR 0008 §4): numbered plain-SQL files applied in
 * order, each in its own transaction together with its `schema_migrations`
 * row. An explicit deploy step — never run on app boot, so two starting
 * instances cannot race. An advisory lock stops two *runners* racing too.
 */

export const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_KEY = '8008002';

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
): Promise<MigrationReport> {
  const report: MigrationReport = { applied: [], skipped: [] };
  const client = await pool.connect();
  let broken = false;
  try {
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
        await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
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
  } finally {
    client.release(broken);
  }
}
