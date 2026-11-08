import { ContentError } from '@/server/content/errors';

/**
 * Money handling for the Planner.
 *
 * Every amount in this system is an integer count of đồng — never a float,
 * never a minor unit (ADR 0001 §5, ADR 0002 §5). This module is the single
 * place that enforces that, and the single boundary where a value coming from
 * outside TypeScript is turned into a number we are willing to do arithmetic
 * with.
 *
 * ## Why BigInt matters here even without a database
 *
 * The target column type is Postgres `BIGINT` (64-bit). A `BIGINT` driver hands
 * JavaScript either a `bigint`, or a decimal `string`, depending on the driver
 * and its configuration — `JSON.stringify` throws outright on the first and
 * silently keeps the second as a string, so an unguarded API would either 500
 * or start returning `"5000000"` where it used to return `5000000`.
 *
 * `normalizeVnd` accepts all three shapes and produces one; `jsonSafe` is the
 * last line of defence on the response path. The domain cap (10^12 đồng, from
 * `vndSchema`) sits far below `Number.MAX_SAFE_INTEGER` (≈9.007×10^15), so every
 * legal amount survives the round trip through a double exactly. Anything that
 * does not fit is a bug or a unit mistake, and is refused loudly rather than
 * rounded quietly.
 */

/** Matches `vndSchema` in the content system — one cap, defined once there. */
export const MAX_VND = 1_000_000_000_000;

/** The largest integer a double represents exactly: 2^53 − 1. */
export const MAX_SAFE_VND = Number.MAX_SAFE_INTEGER;

function moneyError(message: string, path: string): ContentError {
  return new ContentError('validation_failed', message, [{ path, message }]);
}

/**
 * Turns a `number | bigint | string` amount into a safe integer number of đồng,
 * or throws. This is what a future SQL adapter calls on every row it reads.
 */
export function normalizeVnd(value: unknown, path = 'amountVnd'): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw moneyError('VND amounts must be whole đồng', path);
    }
    return guard(value, path);
  }

  if (typeof value === 'bigint') {
    // Compared as BigInt *before* the conversion: `Number(huge)` would round
    // first and then pass a check made against the rounded value.
    if (value > BigInt(MAX_SAFE_VND) || value < -BigInt(MAX_SAFE_VND)) {
      throw moneyError(
        `VND amount ${value.toString()} exceeds the safe integer range — it cannot be represented exactly in JSON`,
        path,
      );
    }
    return guard(Number(value), path);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw moneyError('VND amounts must be a whole number of đồng', path);
    }
    return normalizeVnd(BigInt(trimmed), path);
  }

  throw moneyError('VND amounts must be a number, a bigint or a digit string', path);
}

function guard(value: number, path: string): number {
  if (value < 0) throw moneyError('VND amounts must not be negative', path);
  if (value > MAX_VND) {
    throw moneyError(
      `VND amount ${value} is implausibly large — check the unit`,
      path,
    );
  }
  return value;
}

/**
 * Adds amounts with the overflow check applied to the running total, so a sum
 * can never drift past the point where integers stay exact.
 */
export function sumVnd(amounts: readonly number[], path = 'total'): number {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
    if (!Number.isSafeInteger(total)) {
      throw moneyError('VND total exceeded the safe integer range', path);
    }
  }
  return total;
}

/**
 * Scales a per-person amount to the whole party. Kept here rather than inlined
 * at the call sites so the multiplication is checked in exactly one place.
 */
export function scaleVnd(amount: number, factor: number, path = 'total'): number {
  const scaled = amount * factor;
  if (!Number.isSafeInteger(scaled)) {
    throw moneyError('VND amount exceeded the safe integer range when scaled', path);
  }
  return scaled;
}

/** Integer đồng per person, rounded to the nearest đồng — there is no sub-đồng. */
export function perPersonVnd(total: number, partySize: number): number {
  if (partySize <= 0) return 0;
  return Math.round(total / partySize);
}

/**
 * Deep-converts any `bigint` in a response payload to a number, refusing the
 * ones that would lose precision. Applied to every Planner response body, so
 * introducing a `BIGINT`-returning driver cannot turn a 200 into a 500.
 */
export function jsonSafe<T>(value: T): T {
  return convert(value) as T;
}

function convert(value: unknown): unknown {
  if (typeof value === 'bigint') return normalizeVnd(value);
  if (Array.isArray(value)) return value.map(convert);
  if (value !== null && typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = convert(item);
    return out;
  }
  return value;
}
