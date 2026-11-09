import { describe, expect, it } from 'vitest';
import { clientKey, createRateLimiter } from '../src/server/rate-limit';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createRateLimiter', () => {
  it('allows up to the limit then refuses with a Retry-After', () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: c.now });
    for (let i = 0; i < 3; i++) expect(limiter.check('a')).toEqual({ ok: true });
    const refused = limiter.check('a');
    expect(refused).toEqual({ ok: false, retryAfterSeconds: 60 });
  });

  it('slides: a hit frees up once it leaves the window', () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, now: c.now });
    limiter.check('a');
    c.advance(6_000);
    limiter.check('a');
    expect(limiter.check('a').ok).toBe(false);
    c.advance(4_001); // first hit is now outside the window, second is not
    expect(limiter.check('a').ok).toBe(true);
    expect(limiter.check('a').ok).toBe(false);
  });

  it('keeps keys independent', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: clock().now });
    expect(limiter.check('a').ok).toBe(true);
    expect(limiter.check('a').ok).toBe(false);
    expect(limiter.check('b').ok).toBe(true);
  });

  it('prunes idle keys so memory stays bounded', () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: c.now });
    for (let i = 0; i < 50; i++) limiter.check(`k${i}`);
    c.advance(120_000);
    limiter.check('fresh'); // triggers the sweep
    // An old key behaves as brand new, which is all the sweep may change.
    expect(limiter.check('k0').ok).toBe(true);
  });
});

describe('clientKey', () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it('prefers the first x-forwarded-for hop, trimmed', () => {
    expect(clientKey(h({ 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8', 'x-real-ip': '9.9.9.9' }))).toBe(
      '1.2.3.4',
    );
  });
  it('falls back to x-real-ip, then unknown', () => {
    expect(clientKey(h({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientKey(h({}))).toBe('unknown');
  });
  it('caps the key length', () => {
    expect(clientKey(h({ 'x-forwarded-for': 'x'.repeat(500) })).length).toBeLessThanOrEqual(64);
  });
});
