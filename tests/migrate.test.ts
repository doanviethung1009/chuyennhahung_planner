import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContentError } from '../src/server/content/errors';
import { describe, expect, it } from 'vitest';
import {
  checksumOf,
  MIGRATION_FILE,
  migrateOnStartup,
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

  it('holds one session lock around the bootstrap and every file, then frees it', async () => {
    const { pool, log } = fakeMigrationPool();
    await runMigrations(pool, [file('0001_a.sql', 'CREATE TABLE a ()')]);
    const lock = log.indexOf('SELECT pg_advisory_lock($1)');
    const bootstrap = log.findIndex((l) => l.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations'));
    const unlock = log.indexOf('SELECT pg_advisory_unlock($1)');
    expect(lock).toBe(1);
    expect(bootstrap).toBeGreaterThan(lock);
    expect(log.indexOf('BEGIN')).toBeGreaterThan(bootstrap);
    expect(unlock).toBe(log.length - 1);
  });

  it('bounds the wait for the lock, then resets the timeout before any migration runs', async () => {
    const queries: { text: string; values?: unknown[] }[] = [];
    const pool: PgPoolLike = {
      async connect() {
        return {
          async query(text: string, values?: unknown[]) {
            queries.push({ text: text.trim().split('\n')[0]!, values });
            return { rows: [] };
          },
          release() {},
        };
      },
    };
    await runMigrations(pool, [file('0001_a.sql', 'CREATE TABLE a ()')], '7s');
    const texts = queries.map((q) => q.text);
    expect(queries[0]).toEqual({ text: "SELECT set_config('lock_timeout', $1, false)", values: ['7s'] });
    expect(texts[1]).toBe('SELECT pg_advisory_lock($1)');
    expect(texts[2]).toBe('RESET lock_timeout');
    expect(texts.indexOf('CREATE TABLE a ()')).toBeGreaterThan(2);
  });

  it('gives up when the lock wait times out, destroys the connection and never unlocks', async () => {
    const log: string[] = [];
    let destroyed: boolean | undefined;
    const pool: PgPoolLike = {
      async connect() {
        return {
          async query(text: string) {
            log.push(text.trim().split('\n')[0]!);
            if (text.includes('pg_advisory_lock(')) {
              throw Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' });
            }
            return { rows: [] };
          },
          release(destroy?: boolean | Error) {
            destroyed = Boolean(destroy);
          },
        };
      },
    };
    await expect(runMigrations(pool, [file('0001_a.sql', 'CREATE TABLE a ()')])).rejects.toMatchObject({ code: '55P03' });
    expect(log).not.toContain('SELECT pg_advisory_unlock($1)');
    expect(log).not.toContain('CREATE TABLE a ()');
    expect(destroyed).toBe(true);
  });

  it('frees the lock when a file fails', async () => {
    const { pool, log } = fakeMigrationPool({}, 'BROKEN');
    await expect(runMigrations(pool, [file('0001_a.sql', 'BROKEN')])).rejects.toThrow();
    expect(log.at(-1)).toBe('SELECT pg_advisory_unlock($1)');
  });

  it('destroys the connection if the unlock itself fails', async () => {
    const released: unknown[] = [];
    const pool: PgPoolLike = {
      async connect() {
        return {
          async query(text: string) {
            if (text.includes('pg_advisory_unlock')) throw new Error('gone');
            return { rows: [] };
          },
          release(destroy) {
            released.push(destroy);
          },
        };
      },
    };
    await runMigrations(pool, []);
    expect(released).toEqual([true]);
  });

  it('startup migration answers 503 with no driver detail, for a bad file and a dead database', async () => {
    const secret = 'postgres://planner:hunter2@db.internal/planner';
    const bad = fakeMigrationPool({}, 'BROKEN');
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));
    writeFileSync(join(dir, '0001_x.sql'), 'BROKEN');
    const error = (await migrateOnStartup(bad.pool, dir).catch((e: unknown) => e)) as ContentError;
    expect(error).toBeInstanceOf(ContentError);
    expect(error.status).toBe(503);
    expect(error.code).toBe('service_unavailable');

    const dead: PgPoolLike = {
      connect: async () => {
        throw Object.assign(new Error(`connect ECONNREFUSED ${secret}`), { code: 'ECONNREFUSED' });
      },
    };
    const refused = (await migrateOnStartup(dead, dir).catch((e: unknown) => e)) as ContentError;
    expect(refused.status).toBe(503);
    expect(refused.message).not.toContain('hunter2');
  });

  it('reads only numbered .sql files, in order, from db/migrations', async () => {
    const files = await readMigrationFiles('db/migrations');
    expect(files.map((f) => f.name)).toEqual(readdirSync('db/migrations').filter((n) => MIGRATION_FILE.test(n)).sort());
    expect(files[0]!.name).toBe('0001_planner.sql');
    expect(MIGRATION_FILE.test('0001_planner.down.sql')).toBe(false);
  });
});
