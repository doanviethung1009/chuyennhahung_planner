/**
 * A small in-memory sliding-window rate limiter (ADR 0005).
 *
 * Honest limits: it is per process, so a multi-instance deployment multiplies
 * the effective limit, and the key comes from a forwarded header the client can
 * spoof. It is a speed bump against token guessing, not an authorisation
 * control — the 256-bit share token is what actually stops enumeration.
 *
 * Because the per-client key can be forged, nothing whose cost matters relies
 * on it alone (ADR 0007): Google signups also pass a global bucket, in-flight
 * Google attempts have a global ceiling (`MAX_LIVE_OAUTH_ATTEMPTS`), password
 * hashing has a concurrency gate (`password.ts`), and password guesses are
 * also counted per account.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

/**
 * The same contract for a limiter whose counter lives outside the process
 * (PostgreSQL, ADR 0019 §3). It may reject: a failed backend is a
 * `service_unavailable` `ContentError`, and the caller must not write — fail
 * closed. The sync `RateLimiter` stays for reads and the JSON store.
 */
export interface AsyncRateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

/** Wraps an in-process limiter for callers that take the async interface. */
export function asAsyncLimiter(limiter: RateLimiter): AsyncRateLimiter {
  return { check: async (key) => limiter.check(key) };
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Injected so tests can move time by hand. */
  now?: () => number;
  /** Ceiling on tracked keys; defaults to `MAX_KEYS`. Injectable for tests. */
  maxKeys?: number;
}

/** Idle keys are pruned at most this often, bounding memory. */
const PRUNE_INTERVAL_MS = 60_000;
/** Hard ceiling on tracked keys, so a flood of distinct keys cannot grow forever. */
const MAX_KEYS = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const maxKeys = options.maxKeys ?? MAX_KEYS;
  const now = options.now ?? Date.now;
  /**
   * Kept in least-recently-seen order: every `check` re-inserts its key at the
   * end, so the first entries are the ones idle longest.
   */
  const hits = new Map<string, number[]>();
  let lastPrune = now();

  const isBlocked = (stamps: number[], at: number) =>
    stamps.filter((t) => t > at - windowMs).length >= limit;

  function prune(at: number): void {
    lastPrune = at;
    for (const [key, stamps] of hits) {
      const last = stamps[stamps.length - 1];
      if (last === undefined || last <= at - windowMs) hits.delete(key);
    }
    if (hits.size <= maxKeys) return;

    // Over the ceiling (a flood of distinct keys). Evict least-recently-seen
    // keys first, and never a key that is currently blocked: otherwise a
    // client could reset its own bucket by spraying fresh keys until it was
    // evicted. Blocked keys go only if nothing else is left to drop.
    for (const [key, stamps] of hits) {
      if (hits.size <= maxKeys) return;
      if (!isBlocked(stamps, at)) hits.delete(key);
    }
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) return;
      hits.delete(key);
    }
  }

  function record(key: string, stamps: number[]): void {
    hits.delete(key);
    hits.set(key, stamps);
  }

  return {
    check(key) {
      const at = now();
      if (at - lastPrune >= PRUNE_INTERVAL_MS || hits.size >= maxKeys) prune(at);

      const stamps = (hits.get(key) ?? []).filter((t) => t > at - windowMs);
      if (stamps.length >= limit) {
        record(key, stamps);
        const oldest = stamps[0] ?? at;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - at) / 1000));
        return { ok: false, retryAfterSeconds };
      }
      stamps.push(at);
      record(key, stamps);
      return { ok: true };
    },
  };
}

const MAX_KEY_LENGTH = 64;

/**
 * The caller's address as far as headers tell us: first hop of
 * `x-forwarded-for`, else `x-real-ip`, else `'unknown'`. Spoofable — see above.
 */
export function clientKey(headers: Pick<Headers, 'get'>): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded.slice(0, MAX_KEY_LENGTH);
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, MAX_KEY_LENGTH);
  return 'unknown';
}

/** Share-link reads: 60 per minute per client. Shared by the API and the page. */
export const shareReadLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
/**
 * Review write limits. Their counters are shared across instances when the
 * Planner runs on PostgreSQL, so they are built in `planner/instance.ts`
 * (`getWriteLimiters`) from these specs; without a database they are the
 * in-process limiters below.
 */
export const WRITE_LIMITS = {
  /** Reviews written by a signed-in traveller: 5 per hour per user (ADR 0014). */
  plannerReview: { name: 'planner-review', limit: 5, windowMs: 60 * 60_000 },
  /**
   * Reviews from a visitor with no account: 10 per hour per client (owner, 2026-11-17;
   * was 3 in ADR 0014). Reaching it is recorded for staff (`guest_limit` event).
   * The key is forgeable, so the repository also caps one place at 20 a day.
   */
  guestReview: { name: 'guest-review', limit: 10, windowMs: 60 * 60_000 },
  /** Content reports (batch 10.5): 10 per day per member, or per client for a guest. */
  report: { name: 'report', limit: 10, windowMs: 24 * 60 * 60_000 },
} as const;
export type WriteLimitName = keyof typeof WRITE_LIMITS;
/** Sign-in attempts: 10 per minute per client. A separate bucket. */
export const signInLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
/**
 * Password attempts against one account: 5 per 15 minutes, keyed by the
 * normalised email (ADR 0007). Slows guessing from many addresses; it
 * throttles and never locks, so it cannot be used to lock staff out.
 */
export const signInAccountLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
/** Self-service Google unlink: 10 per 15 minutes per user (ADR 0007). */
export const googleUnlinkLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });
/** Accounts created by a first Google sign-in: 3 per hour per client. */
export const signupLimiter = createRateLimiter({ limit: 3, windowMs: 60 * 60_000 });
/**
 * The same, across all clients: 30 per hour. `signupLimiter` keys on a
 * forgeable header, so this global bucket is what bounds account creation
 * when the header is rotated. Checked with `GLOBAL_KEY`.
 */
export const signupGlobalLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });
export const GLOBAL_KEY = 'all';

/**
 * Whether one more Google signup may go ahead for this client. The per-client
 * bucket is asked first, so a client already over its own limit does not use
 * up the global one.
 */
export function allowSignup(key: string): boolean {
  return signupLimiter.check(key).ok && signupGlobalLimiter.check(GLOBAL_KEY).ok;
}

/**
 * For the `/shared/[token]` page, which has no Request: pass `await headers()`.
 * Returns the same result shape as `check`.
 */
export function checkShareRead(headers: Pick<Headers, 'get'>): RateLimitResult {
  return shareReadLimiter.check(clientKey(headers));
}
