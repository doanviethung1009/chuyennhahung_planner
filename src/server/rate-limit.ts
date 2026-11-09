/**
 * A small in-memory sliding-window rate limiter (ADR 0005).
 *
 * Honest limits: it is per process, so a multi-instance deployment multiplies
 * the effective limit, and the key comes from a forwarded header the client can
 * spoof. It is a speed bump against token guessing, not an authorisation
 * control — the 256-bit share token is what actually stops enumeration.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Injected so tests can move time by hand. */
  now?: () => number;
}

/** Idle keys are pruned at most this often, bounding memory. */
const PRUNE_INTERVAL_MS = 60_000;
/** Hard ceiling on tracked keys, so a flood of distinct keys cannot grow forever. */
const MAX_KEYS = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();
  let lastPrune = now();

  function prune(at: number): void {
    lastPrune = at;
    for (const [key, stamps] of hits) {
      const last = stamps[stamps.length - 1];
      if (last === undefined || last <= at - windowMs) hits.delete(key);
    }
    if (hits.size > MAX_KEYS) {
      // Drop oldest-inserted keys first; Map iterates in insertion order.
      for (const key of hits.keys()) {
        if (hits.size <= MAX_KEYS) break;
        hits.delete(key);
      }
    }
  }

  return {
    check(key) {
      const at = now();
      if (at - lastPrune >= PRUNE_INTERVAL_MS || hits.size > MAX_KEYS) prune(at);

      const stamps = (hits.get(key) ?? []).filter((t) => t > at - windowMs);
      if (stamps.length >= limit) {
        hits.set(key, stamps);
        const oldest = stamps[0] ?? at;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - at) / 1000));
        return { ok: false, retryAfterSeconds };
      }
      stamps.push(at);
      hits.set(key, stamps);
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
/** Sign-in attempts: 10 per minute per client. A separate bucket. */
export const signInLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/**
 * For the `/shared/[token]` page, which has no Request: pass `await headers()`.
 * Returns the same result shape as `check`.
 */
export function checkShareRead(headers: Pick<Headers, 'get'>): RateLimitResult {
  return shareReadLimiter.check(clientKey(headers));
}
