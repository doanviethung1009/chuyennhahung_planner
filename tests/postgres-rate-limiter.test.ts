import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readGuestKeySecret } from '../src/server/community/guest-key';
import { ContentError } from '../src/server/content/errors';
import {
  COUNTER_RETENTION_MS,
  counterKey,
  createPostgresRateLimiter,
  type PgQueryable,
} from '../src/server/persistence/postgres-rate-limiter';

const SECRET = 'limiter-test-secret-0123456789abcdefghij';

/** No database needed: a fake pool that records statements and can fail. */
function fakePool(count = 1) {
  const calls: { text: string; values: unknown[] }[] = [];
  const pool: PgQueryable & { fail: boolean } = {
    fail: false,
    async query(text, values = []) {
      calls.push({ text, values });
      if (pool.fail) throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432 role=secret'), { code: 'ECONNREFUSED' });
      return { rows: text.startsWith('INSERT') ? [{ count }] : [] };
    },
  };
  return { pool, calls };
}

describe('Postgres rate limiter (fake pool)', () => {
  it('stores a hash, never the raw key, and namespaces by limiter name', async () => {
    const { pool, calls } = fakePool();
    await createPostgresRateLimiter({ pool, name: 'a', limit: 3, windowMs: 1000, now: () => 5_000 }).check('203.0.113.9');
    const stored = calls[0]!.values[0] as string;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(calls)).not.toContain('203.0.113.9');
    expect(counterKey(SECRET, 'a', 'k')).not.toBe(counterKey(SECRET, 'b', 'k'));
  });

  it('keys the counter with the HMAC secret: no unsalted hash of the address, and a missing secret is a 503 with no statement', async () => {
    const { pool, calls } = fakePool();
    const secret = () => SECRET;
    await createPostgresRateLimiter({ pool, name: 'a', limit: 3, windowMs: 1000, secret }).check('203.0.113.9');
    expect(calls[0]!.values[0]).toBe(counterKey(SECRET, 'a', '203.0.113.9'));
    const unsalted = createHash('sha256').update('a\u0000203.0.113.9').digest('hex');
    expect(calls[0]!.values[0]).not.toBe(unsalted);
    expect(counterKey(SECRET, 'a', 'k')).not.toBe(counterKey('other-secret-0123456789abcdefghijkl', 'a', 'k'));

    const none = fakePool();
    const bare = createPostgresRateLimiter({ pool: none.pool, name: 'a', limit: 3, windowMs: 1000, secret: () => readGuestKeySecret({}) });
    const error = await bare.check('k').catch((e: unknown) => e);
    expect((error as ContentError).code).toBe('service_unavailable');
    expect(none.calls).toHaveLength(0);
  });

  it('fails closed: a database error is service_unavailable with no driver detail', async () => {
    const { pool } = fakePool();
    pool.fail = true;
    const limiter = createPostgresRateLimiter({ pool, name: 'a', limit: 3, windowMs: 1000 });
    const error = await limiter.check('k').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).code).toBe('service_unavailable');
    expect((error as ContentError).message).not.toMatch(/10\.0\.0\.5|secret|ECONNREFUSED/);
  });

  it('blocks above the limit with a Retry-After to the window end', async () => {
    const { pool } = fakePool(4);
    const limiter = createPostgresRateLimiter({ pool, name: 'a', limit: 3, windowMs: 60_000, now: () => 60_000 * 10 + 15_000 });
    expect(await limiter.check('k')).toEqual({ ok: false, retryAfterSeconds: 45 });
  });

  it('sweeps old windows at most once per interval, without blocking or failing the check', async () => {
    const { pool, calls } = fakePool();
    let t = 0;
    const limiter = createPostgresRateLimiter({ pool, name: 'a', limit: 3, windowMs: 1000, now: () => t, sweepIntervalMs: 10_000 });
    await limiter.check('k');
    expect(calls.filter((c) => c.text.startsWith('DELETE'))).toHaveLength(0);
    t = 10_000;
    await limiter.check('k');
    await limiter.check('k');
    const sweeps = calls.filter((c) => c.text.startsWith('DELETE'));
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0]!.values).toEqual([10_000 - COUNTER_RETENTION_MS]);
    expect(COUNTER_RETENTION_MS).toBeLessThanOrEqual(48 * 60 * 60_000);
  });

  it('refuses a window longer than half the retention', () => {
    const { pool } = fakePool();
    expect(() => createPostgresRateLimiter({ pool, name: 'a', limit: 1, windowMs: COUNTER_RETENTION_MS / 2 + 1 })).toThrow();
    expect(() => createPostgresRateLimiter({ pool, name: 'a', limit: 1, windowMs: COUNTER_RETENTION_MS / 2 })).not.toThrow();
  });

  it('sweeps in bounded batches until a short batch', async () => {
    const batches: number[] = [1000, 1000, 5];
    const calls: string[] = [];
    const pool: PgQueryable = {
      async query(text) {
        calls.push(text);
        if (text.startsWith('DELETE')) return { rows: Array.from({ length: batches.shift() ?? 0 }, () => ({})) };
        return { rows: [{ count: 1 }] };
      },
    };
    let t = 0;
    const limiter = createPostgresRateLimiter({ pool, name: 'a', limit: 3, windowMs: 1000, now: () => t, sweepIntervalMs: 1 });
    t = 5;
    await limiter.check('k');
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(3);
  });
});
