import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checksumOf,
  MIGRATION_FILE,
  readMigrationFiles,
  runMigrations,
  type MigrationFile,
} from '../src/server/persistence/migrate';
import type { PgPoolLike } from '../src/server/persistence/postgres-planner-store';

function fakeMigrationPool(applied: Record<string, string> = {}, failOn?: string) {
  const log: string[] = [];
  const pool: PgPoolLike = {
    async connect() {
      return {
        async query(text: string, values?: unknown[]) {
          log.push(text.trim().split('\n')[0]!);
          if (failOn && text.includes(failOn)) throw new Error('syntax error');
          if (text.startsWith('SELECT checksum')) {
            const sum = applied[values![0] as string];
            return { rows: sum ? [{ checksum: sum }] : [] };
          }
          return { rows: [] };
        },
        release() {},
      };
    },
  };
  return { pool, log };
}

const file = (name: string, sql: string): MigrationFile => ({ name, sql, checksum: checksumOf(sql) });

describe('migration runner', () => {
  it('applies each new file in its own transaction and records it', async () => {
    const { pool, log } = fakeMigrationPool();
    const report = await runMigrations(pool, [file('0001_a.sql', 'CREATE TABLE a ()'), file('0002_b.sql', 'CREATE TABLE b ()')]);
    expect(report).toEqual({ applied: ['0001_a.sql', '0002_b.sql'], skipped: [] });
    expect(log.filter((l) => l === 'BEGIN')).toHaveLength(2);
    expect(log.filter((l) => l === 'COMMIT')).toHaveLength(2);
    expect(log.filter((l) => l.startsWith('INSERT INTO schema_migrations'))).toHaveLength(2);
  });

  it('skips a file that is already applied', async () => {
    const a = file('0001_a.sql', 'CREATE TABLE a ()');
    const { pool, log } = fakeMigrationPool({ '0001_a.sql': a.checksum });
    const report = await runMigrations(pool, [a]);
    expect(report).toEqual({ applied: [], skipped: ['0001_a.sql'] });
    expect(log).not.toContain('CREATE TABLE a ()');
  });

  it('refuses a file edited after it was applied', async () => {
    const { pool } = fakeMigrationPool({ '0001_a.sql': 'old-checksum' });
    await expect(runMigrations(pool, [file('0001_a.sql', 'CREATE TABLE a ()')])).rejects.toThrow(/edited after/);
  });

  it('rolls back a failing file and does not run the next', async () => {
    const { pool, log } = fakeMigrationPool({}, 'BROKEN');
    await expect(
      runMigrations(pool, [file('0001_a.sql', 'BROKEN'), file('0002_b.sql', 'CREATE TABLE b ()')]),
    ).rejects.toThrow('syntax error');
    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('CREATE TABLE b ()');
    expect(log.filter((l) => l.startsWith('INSERT INTO schema_migrations'))).toHaveLength(0);
  });

  it('reads only numbered .sql files, in order, from db/migrations', async () => {
    const files = await readMigrationFiles('db/migrations');
    expect(files.map((f) => f.name)).toEqual(readdirSync('db/migrations').filter((n) => MIGRATION_FILE.test(n)).sort());
    expect(files[0]!.name).toBe('0001_planner.sql');
    expect(MIGRATION_FILE.test('0001_planner.down.sql')).toBe(false);
  });
});
