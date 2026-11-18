import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateOnStartup } from '../src/server/persistence/migrate';
import { createPostgresPool } from '../src/server/persistence/postgres-pool';
import { createPostgresRateLimiter } from '../src/server/persistence/postgres-rate-limiter';

/**
 * The shared limiter against a real database. Runs only with `TEST_DATABASE_URL`
 * (a throwaway schema, dropped at the end); otherwise skipped and reported as
 * NOT RUN. CI sets the variable.
 */
const url = process.env.TEST_DATABASE_URL;
const HOUR = 3_600_000;

describe.skipIf(!url)('Postgres rate limiter (TEST_DATABASE_URL)', () => {
  const schema = `pgrl_${randomBytes(6).toString('hex')}`;
  let admin: pg.Pool;
  const pools: pg.Pool[] = [];
  const open = () => {
    const pool = createPostgresPool(url!, { options: `-c search_path=${schema}`, max: 5 });
    pools.push(pool);
    return pool;
  };
  let pool: pg.Pool;
  let t = 1_800_000_000_000 - (1_800_000_000_000 % HOUR);
  const make = (p: pg.Pool, over: Partial<Parameters<typeof createPostgresRateLimiter>[0]> = {}) =>
    createPostgresRateLimiter({ pool: p, name: 'guest-review', limit: 3, windowMs: HOUR, now: () => t, ...over });

  beforeAll(async () => {
    admin = createPostgresPool(url!, { max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = open();
    await migrateOnStartup(pool);
  });
  afterAll(async () => {
    for (const p of pools) await p.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE rate_limit_counters');
  });

  it('two instances on one database share one count', async () => {
    const a = make(open());
    const b = make(open());
    expect((await a.check('1.1.1.1')).ok).toBe(true);
    expect((await b.check('1.1.1.1')).ok).toBe(true);
    expect((await a.check('1.1.1.1')).ok).toBe(true);
    expect(await b.check('1.1.1.1')).toEqual({ ok: false, retryAfterSeconds: 3600 });
    expect((await b.check('2.2.2.2')).ok).toBe(true);
  });

  it('counts concurrent checks exactly', async () => {
    const limiters = [make(open()), make(open()), make(open())];
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => limiters[i % 3]!.check('9.9.9.9')));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
  });

  it('keeps the count across a "restart" and resets at the next window', async () => {
    for (let i = 0; i < 3; i += 1) await make(open()).check('k');
    const restarted = make(open());
    t += 10 * 60_000;
    expect(await restarted.check('k')).toEqual({ ok: false, retryAfterSeconds: 3000 });
    t += 50 * 60_000;
    expect((await restarted.check('k')).ok).toBe(true);
  });

  it('keeps limiters apart by name and stores no raw key', async () => {
    await make(pool).check('k');
    await make(pool, { name: 'planner-review' }).check('k');
    const { rows } = await pool.query('SELECT key, count FROM rate_limit_counters');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(String(r.key)))).toBe(true);
  });

  it('sweeps windows older than the retention (48 h)', async () => {
    await pool.query("INSERT INTO rate_limit_counters VALUES ('old', 1, 2)");
    const limiter = make(pool, { sweepIntervalMs: 1 });
    t += 1000;
    await limiter.check('k');
    t += 1000;
    await limiter.check('k');
    await new Promise((r) => setTimeout(r, 100));
    const { rows } = await pool.query("SELECT 1 FROM rate_limit_counters WHERE key = 'old'");
    expect(rows).toHaveLength(0);
  });

  it('fails closed when the database is gone', async () => {
    const dead = createPostgresPool(url!, { options: `-c search_path=${schema}`, max: 1 });
    const limiter = make(dead);
    await dead.end();
    await expect(limiter.check('k')).rejects.toMatchObject({ code: 'service_unavailable' });
  });
});
