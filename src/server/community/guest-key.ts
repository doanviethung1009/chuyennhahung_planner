import { createHmac } from 'node:crypto';
import { ContentError } from '../content/errors';

/**
 * The one keyed hash for anonymous visitors (ADR 0024). Every stored identifier
 * derived from a client address — a guest review's key, a guest restriction's
 * key, a report's client key and the limiter's counter key — is
 * `HMAC-SHA256(secret, …)`, so no unsalted hash of an address remains: without
 * the secret the stored values cannot be re-derived by enumerating addresses.
 *
 * The secret is server-only (`GUEST_KEY_SECRET`, ≥ 32 characters like
 * `ADMIN_API_TOKEN`): never logged, returned or committed. When it is missing
 * or too short, anything that would store a guest key fails closed with
 * `503 service_unavailable`; there is no fallback to an unsalted hash.
 * Rotating it resets guest bans and de-duplication at once (accepted, ADR 0024).
 */
export const GUEST_KEY_SECRET_ENV = 'GUEST_KEY_SECRET';
export const GUEST_KEY_SECRET_MIN_LENGTH = 32;
/** Hex characters kept for a guest key (the column shape since ADR 0015). */
const GUEST_KEY_LENGTH = 32;

export type SecretSource = () => string;

/** The configured secret, or `503 service_unavailable`. The message names the variable, never a value. */
export function readGuestKeySecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env[GUEST_KEY_SECRET_ENV]?.trim();
  if (!secret || secret.length < GUEST_KEY_SECRET_MIN_LENGTH) {
    throw new ContentError(
      'service_unavailable',
      `${GUEST_KEY_SECRET_ENV} is not set, or is shorter than ${GUEST_KEY_SECRET_MIN_LENGTH} characters — anonymous writes are disabled`,
    );
  }
  return secret;
}

/** `HMAC-SHA256(secret, clientKey)`, hex, first 32 characters. */
export function guestKeyOf(secret: string, clientKey: string): string {
  return createHmac('sha256', secret).update(`guest\0${clientKey}`).digest('hex').slice(0, GUEST_KEY_LENGTH);
}

/** The limiter's stored counter key: full hex, namespaced by limiter, domain-separated from guest keys. */
export function limiterKeyOf(secret: string, name: string, key: string): string {
  return createHmac('sha256', secret).update(`limiter\0${name}\0${key}`).digest('hex');
}
