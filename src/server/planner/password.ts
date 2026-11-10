import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { ContentError } from '@/server/content/errors';

/**
 * Password hashing for operator-created accounts (ADR 0007).
 *
 * `scrypt` from `node:crypto` — no dependency. The parameters live inside each
 * stored hash (`scrypt$N$r$p$salt$hash`), so the cost can be raised later and an
 * old hash is still verifiable; `verifyPassword` reports when a hash is weaker
 * than the current cost so the caller can upgrade it on a successful sign-in.
 */

/** OWASP baseline: N = 2^17, r = 8, p = 1 — about 128 MB per hash. */
export const DEFAULT_SCRYPT_COST_LOG2 = 17;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** Refuses a stored hash whose cost would let a hand-edited file exhaust memory. */
const MAX_COST_LOG2 = 20;

/**
 * A counting semaphore with a bounded queue. Past `maxWaiting` it refuses at
 * once instead of queueing, so a flood cannot pile up unbounded work.
 */
export interface ConcurrencyGate {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createConcurrencyGate(
  maxActive: number,
  maxWaiting: number,
  onFull: () => Error,
): ConcurrencyGate {
  let active = 0;
  const waiting: Array<() => void> = [];
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  };
  return {
    async run(task) {
      if (active >= maxActive) {
        if (waiting.length >= maxWaiting) throw onFull();
        // The slot is handed over by `release` without dropping `active`.
        await new Promise<void>((resolve) => waiting.push(resolve));
      } else {
        active += 1;
      }
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

/**
 * Each derivation holds about 128 MB, and the per-client limiters key on a
 * header a client can forge. This bounds the memory scrypt can be made to
 * use, whatever the traffic: 4 at once (~512 MB), 32 waiting, then 429.
 */
const SCRYPT_MAX_ACTIVE = 4;
const SCRYPT_MAX_WAITING = 32;
const scryptGate = createConcurrencyGate(
  SCRYPT_MAX_ACTIVE,
  SCRYPT_MAX_WAITING,
  () => new ContentError('rate_limited', 'too many password checks in progress — try again shortly', [], 5),
);

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  // Node's default `maxmem` (32 MB) is below what N = 2^17 needs (128 * N * r).
  const maxmem = 128 * (options.N ?? 0) * (options.r ?? 0) * 2;
  return scryptGate.run(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password.normalize('NFC'), salt, KEY_BYTES, { ...options, maxmem }, (error, key) => {
          if (error) reject(error);
          else resolve(key);
        });
      }),
  );
}

export async function hashPassword(
  password: string,
  costLog2 = DEFAULT_SCRYPT_COST_LOG2,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const N = 2 ** costLog2;
  const key = await derive(password, salt, { N, r: BLOCK_SIZE, p: PARALLELISM });
  return ['scrypt', N, BLOCK_SIZE, PARALLELISM, salt.toString('base64url'), key.toString('base64url')].join('$');
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

export function parsePasswordHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, n, r, p, salt, key] = parts;
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (!Number.isInteger(N) || N < 2 || (N & (N - 1)) !== 0 || N > 2 ** MAX_COST_LOG2) return null;
  if (!Number.isInteger(R) || R < 1 || R > 32) return null;
  if (!Number.isInteger(P) || P < 1 || P > 16) return null;
  const saltBytes = Buffer.from(salt ?? '', 'base64url');
  const keyBytes = Buffer.from(key ?? '', 'base64url');
  if (saltBytes.length < 8 || keyBytes.length !== KEY_BYTES) return null;
  return { N, r: R, p: P, salt: saltBytes, key: keyBytes };
}

export interface PasswordCheck {
  ok: boolean;
  /** True when `ok` and the stored hash is cheaper than the current cost. */
  needsRehash: boolean;
}

export async function verifyPassword(
  password: string,
  stored: string,
  costLog2 = DEFAULT_SCRYPT_COST_LOG2,
): Promise<PasswordCheck> {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return { ok: false, needsRehash: false };
  const key = await derive(password, parsed.salt, { N: parsed.N, r: parsed.r, p: parsed.p });
  const ok = key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
  return { ok, needsRehash: ok && parsed.N < 2 ** costLog2 };
}

/**
 * A hash nobody's password matches, verified when the email is unknown so an
 * unknown account costs the same time as a wrong password (no enumeration by
 * timing).
 *
 * Built from random bytes, not by running scrypt: verifying it is what costs
 * one derivation, and that goes through the same gate as every real check, so
 * an unknown and a known email are refused alike — 401, or 429 when the gate
 * is full. Nothing is cached, so no failure can be cached either (a cached
 * rejected promise once turned the gate into a lasting enumeration oracle).
 */
export function dummyPasswordHash(costLog2 = DEFAULT_SCRYPT_COST_LOG2): string {
  return [
    'scrypt',
    2 ** costLog2,
    BLOCK_SIZE,
    PARALLELISM,
    randomBytes(SALT_BYTES).toString('base64url'),
    randomBytes(KEY_BYTES).toString('base64url'),
  ].join('$');
}

/** No 0/O, 1/l/I: read aloud or copied off a screen without ambiguity. */
const TEMPORARY_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TEMPORARY_LENGTH = 16;

/** ~92 bits; shown once, and only good until the user changes it. */
export function generateTemporaryPassword(): string {
  let out = '';
  for (let i = 0; i < TEMPORARY_LENGTH; i += 1) {
    out += TEMPORARY_ALPHABET[randomInt(TEMPORARY_ALPHABET.length)];
  }
  return out;
}
