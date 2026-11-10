import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ContentError } from '@/server/content/errors';
import { userRole, type Role } from '@/server/identity/permissions';
import type { PlannerUser } from './schemas';

/**
 * Who is asking, and which trips they may touch.
 *
 * The Travel Content System has exactly one principal — the `ADMIN_API_TOKEN`
 * (`src/server/content/auth.ts`). That is enough for editorial content, where
 * every record belongs to the brand, and not enough for the Planner, where a
 * trip belongs to *a traveller* and the central requirement is that one
 * traveller cannot reach another's trip.
 *
 * So the Planner introduces a real owner: a `plannerUsers` row holding a
 * SHA-256 digest of a 48-byte access token. The token is returned **once**, when
 * an admin provisions or rotates it, and is never stored or returned again.
 *
 * This is deliberately an interim identity model, chosen to keep the existing
 * bearer-token convention rather than to anticipate a session system. What it
 * does guarantee is the part that is expensive to retrofit: every trip row
 * carries an `ownerId`, and every read and write is filtered by it. Swapping
 * the token for a real session later changes how `PlannerIdentity` is obtained
 * and touches nothing below it. See `docs/adr/0002-planner-core.md` §3.
 *
 * ## The session layer (ADR 0004)
 *
 * A browser cannot use the token above: pasting it on every visit is unusable,
 * and keeping it in `localStorage` turns any XSS into a permanent account
 * takeover, because the token is long-lived and cannot expire. So a browser
 * signs in once and gets an `HttpOnly` cookie carrying an opaque session token;
 * what is stored is that token's digest.
 *
 * The token path is kept for curl, scripts and tests. Everything downstream
 * sees one `PlannerIdentity` either way — the only difference it records is
 * `source`, which exists because cookie-authenticated mutations need a
 * same-origin check that bearer ones do not (ADR 0004 §4).
 */

/** 48 raw bytes → 64 base64url chars. Long enough that length is not a knob. */
const TOKEN_BYTES = 48;

/** Rejects anything too short to be one of our tokens before hashing it. */
const MIN_TOKEN_LENGTH = 32;

/**
 * Which credential the request arrived with. It matters for exactly one thing:
 * a cookie is sent automatically by the browser, so a mutation authenticated by
 * one must additionally prove it came from our own origin. A bearer token is
 * only ever sent deliberately and carries no CSRF risk.
 */
export type CredentialSource = 'cookie' | 'bearer';

export interface PlannerIdentity {
  userId: string;
  handle: string;
  source: CredentialSource;
  /** Resolved from the user row on every request; absent reads as `member`. */
  role: Role;
  /**
   * True for a session opened with an operator-issued temporary password that
   * has not been changed yet (ADR 0007). `plannerRoute` refuses every route
   * that has not opted in to serving such a session.
   */
  passwordChangeRequired?: boolean;
}

/** The session cookie's name. Opaque value; no payload, no claims. */
export const SESSION_COOKIE = 'planner_session';

/** 32 raw bytes → 43 base64url chars. */
const SESSION_TOKEN_BYTES = 32;

export function issueAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function issueSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Same construction as the access-token digest, kept as its own function so
 * the two are never confused at a call site: they guard different credentials
 * with different lifetimes.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const value = rest.join(' ').trim();
  return value.length > 0 ? value : null;
}

/**
 * Reads the session cookie off a request. Parsed by hand rather than through a
 * framework helper so this module stays usable from a plain `Request` — the
 * repository and the tests both call it.
 */
export function sessionTokenFromRequest(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

function digestsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const unauthorized = (): ContentError =>
  new ContentError(
    'unauthorized',
    'a valid "Authorization: Bearer <planner access token>" header is required',
  );

/**
 * Finds the user an access token belongs to, or null.
 *
 * Every candidate is compared with `timingSafeEqual` over the fixed-width
 * digest, so a token cannot be recovered byte by byte from response timing.
 * The number of users is not treated as a secret.
 */
export function findUserByAccessToken(
  users: readonly PlannerUser[],
  token: string,
): PlannerUser | null {
  if (token.length < MIN_TOKEN_LENGTH) return null;

  const digest = hashAccessToken(token);
  let found: PlannerUser | null = null;
  for (const user of users) {
    // No early exit: the loop runs the same way whether or not it has matched.
    if (digestsEqual(user.tokenHash, digest)) found = user;
  }
  return found;
}

/** Resolves the caller to a planner user by bearer token, or throws 401. */
export function authorizePlannerUser(
  request: Request,
  users: readonly PlannerUser[],
): PlannerIdentity {
  const presented = bearerToken(request);
  if (!presented) throw unauthorized();

  const found = findUserByAccessToken(users, presented);
  if (!found) throw unauthorized();
  return { userId: found.id, handle: found.handle, source: 'bearer', role: userRole(found) };
}

/**
 * Finds the session a cookie token belongs to, or null. Compared in constant
 * time for the same reason the access token is.
 *
 * Generic over the row so this module does not have to import the schema type.
 */
export function findSessionByToken<T extends { tokenHash: string }>(
  sessions: readonly T[],
  token: string,
): T | null {
  const digest = hashSessionToken(token);
  let found: T | null = null;
  for (const session of sessions) {
    if (digestsEqual(session.tokenHash, digest)) found = session;
  }
  return found;
}

export const sessionExpired = (): ContentError =>
  new ContentError(
    'unauthorized',
    'this session has expired — sign in again at POST /api/planner/session',
  );
