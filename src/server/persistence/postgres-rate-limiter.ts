import { ContentError } from '@/server/content/errors';
import { limiterKeyOf, readGuestKeySecret, type SecretSource } from '@/server/community/guest-key';
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
 * The limiter should get its own small pool with a `statement_timeout`
 * (`planner/instance.ts`), so anonymous traffic cannot hold the Planner store's
 * connections.
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
  /**
   * Supplies the HMAC secret for the stored key (ADR 0024); defaults to the
   * `GUEST_KEY_SECRET` environment variable. A missing secret fails closed.
   */
  secret?: SecretSource;
}

/**
 * Rows older than this are deleted by the sweep, whatever limiter wrote them,
 * so no limiter's window may be longer than half of it (checked on creation).
 * Short on purpose: a client rotating forged keys leaves one row per key per
 * window, so rows can only pile up for about this long. 48 h so the daily
 * report limit (batch 10.5) fits; it was 2 h while every limiter was hourly.
 */
export const COUNTER_RETENTION_MS = 48 * 60 * 60_000;
export const MAX_WINDOW_MS = COUNTER_RETENTION_MS / 2;
/** Rows deleted per statement, and statements per sweep, so one sweep stays light. */
const SWEEP_BATCH = 1000;
const SWEEP_MAX_BATCHES = 10;
const SWEEP_INTERVAL_MS = 10 * 60_000;

const COUNT_SQL = `INSERT INTO rate_limit_counters (key, window_start, count)
VALUES ($1, $2, 1)
ON CONFLICT (key, window_start) DO UPDATE
  SET count = LEAST(rate_limit_counters.count + 1, $3)
RETURNING count`;

const SWEEP_SQL = `DELETE FROM rate_limit_counters WHERE ctid IN (
  SELECT ctid FROM rate_limit_counters WHERE window_start < $1 LIMIT ${SWEEP_BATCH})
RETURNING 1`;

/**
 * The stored key: a keyed hash (ADR 0024), so no address or user id sits in the
 * table in the clear and none can be re-derived without the secret.
 */
export function counterKey(secret: string, name: string, key: string): string {
  return limiterKeyOf(secret, name, key);
}

export function createPostgresRateLimiter(options: PostgresRateLimiterOptions): AsyncRateLimiter {
  const { pool, name, limit, windowMs } = options;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('rate limit must be a positive integer');
  if (!Number.isInteger(windowMs) || windowMs < 1 || windowMs > MAX_WINDOW_MS) {
    throw new Error('rate limit window must be between 1 ms and half the counter retention');
  }
  const now = options.now ?? Date.now;
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
  const readSecret = options.secret ?? readGuestKeySecret;
  let lastSweep = now();
  let sweeping = false;

  /** Best effort and never awaited by a request: a failed sweep only leaves rows for the next one. */
  function maybeSweep(at: number): void {
    if (sweeping || at - lastSweep < sweepIntervalMs) return;
    sweeping = true;
    lastSweep = at;
    void (async () => {
      try {
        for (let i = 0; i < SWEEP_MAX_BATCHES; i += 1) {
          const { rows } = await pool.query(SWEEP_SQL, [at - COUNTER_RETENTION_MS]);
          if (rows.length < SWEEP_BATCH) break;
        }
      } catch {
        // Best effort: the next sweep tries again.
      } finally {
        sweeping = false;
      }
    })();
  }

  return {
    async check(key: string): Promise<RateLimitResult> {
      const at = now();
      const windowStart = Math.floor(at / windowMs) * windowMs;
      // Before the statement, outside the try: a missing secret is its own 503, not a database error.
      const stored = counterKey(readSecret(), name, key);
      let count: number;
      try {
        const result = await pool.query(COUNT_SQL, [stored, windowStart, limit + 1]);
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
