import { createHash } from 'node:crypto';
import { ContentError } from '@/server/content/errors';
import type { AsyncRateLimiter, RateLimitResult } from '@/server/rate-limit';

/**
 * A fixed-window rate limiter whose counters live in PostgreSQL, so every app
 * instance and every restart sees the same count (ADR 0019 §3, batch 10.3).
 *
 * One statement per check — `INSERT … ON CONFLICT DO UPDATE … RETURNING count`
 * — is atomic across processes without a lock. It runs on the pool **outside**
 * the Planner store's transaction and advisory lock: a rate check must neither
 * wait for a long write nor roll back with a failed one (a refused write still
 * counts as an attempt).
 *
 * Fail closed: any database error becomes `503 service_unavailable`, never
 * "allow". The caller checks before it writes, so nothing is stored. The
 * driver's message is dropped — it can carry a host or role name.
 *
 * Honest limits: a fixed window allows up to twice the limit across a window
 * boundary (the in-memory limiter is a sliding window); the key is whatever the
 * caller supplies, so a forgeable `x-forwarded-for` stays forgeable (10.6 is
 * where that is dealt with); each check costs one database round trip, which is
 * not measured.
 */

/** The slice of `pg.Pool` this module uses, so tests can fake it. */
export interface PgQueryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface PostgresRateLimiterOptions {
  pool: PgQueryable;
  /** Namespace, so two limiters can never share a counter. A code constant. */
  name: string;
  limit: number;
  windowMs: number;
  /** Injected so tests can move time by hand. */
  now?: () => number;
  /** How often this instance sweeps old windows; defaults to `SWEEP_INTERVAL_MS`. */
  sweepIntervalMs?: number;
}

/**
 * Rows older than this are deleted by the sweep, whatever limiter wrote them,
 * so no limiter's window may be longer (checked on creation).
 */
export const COUNTER_RETENTION_MS = 24 * 60 * 60_000;
const SWEEP_INTERVAL_MS = 10 * 60_000;

const COUNT_SQL = `INSERT INTO rate_limit_counters (key, window_start, count)
VALUES ($1, $2, 1)
ON CONFLICT (key, window_start) DO UPDATE
  SET count = LEAST(rate_limit_counters.count + 1, $3)
RETURNING count`;

const SWEEP_SQL = 'DELETE FROM rate_limit_counters WHERE window_start < $1';

/** The stored key: a hash, so no address or user id sits in the table in the clear. */
export function counterKey(name: string, key: string): string {
  return createHash('sha256').update(`${name}\0${key}`).digest('hex');
}

export function createPostgresRateLimiter(options: PostgresRateLimiterOptions): AsyncRateLimiter {
  const { pool, name, limit, windowMs } = options;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('rate limit must be a positive integer');
  if (!Number.isInteger(windowMs) || windowMs < 1 || windowMs > COUNTER_RETENTION_MS) {
    throw new Error('rate limit window must be between 1 ms and the counter retention');
  }
  const now = options.now ?? Date.now;
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
  let lastSweep = now();
  let sweeping = false;

  /** Best effort and never awaited by a request: a failed sweep only leaves rows for the next one. */
  function maybeSweep(at: number): void {
    if (sweeping || at - lastSweep < sweepIntervalMs) return;
    sweeping = true;
    lastSweep = at;
    pool
      .query(SWEEP_SQL, [at - COUNTER_RETENTION_MS])
      .catch(() => undefined)
      .finally(() => {
        sweeping = false;
      });
  }

  return {
    async check(key: string): Promise<RateLimitResult> {
      const at = now();
      const windowStart = Math.floor(at / windowMs) * windowMs;
      let count: number;
      try {
        const result = await pool.query(COUNT_SQL, [counterKey(name, key), windowStart, limit + 1]);
        count = Number(result.rows[0]?.count);
        if (!Number.isInteger(count)) throw new Error('no count returned');
      } catch {
        throw new ContentError('service_unavailable', 'the rate limiter database is unavailable');
      }
      maybeSweep(at);
      if (count <= limit) return { ok: true };
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - at) / 1000));
      return { ok: false, retryAfterSeconds };
    },
  };
}
