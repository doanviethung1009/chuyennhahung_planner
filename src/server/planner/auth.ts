import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ContentError } from '@/server/content/errors';
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
 */

/** 48 raw bytes → 64 base64url chars. Long enough that length is not a knob. */
const TOKEN_BYTES = 48;

/** Rejects anything too short to be one of our tokens before hashing it. */
const MIN_TOKEN_LENGTH = 32;

export interface PlannerIdentity {
  userId: string;
  handle: string;
}

export function issueAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashAccessToken(token: string): string {
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
 * Resolves the caller to a planner user, or throws 401.
 *
 * Every candidate is compared with `timingSafeEqual` over the fixed-width
 * digest, so a token cannot be recovered byte by byte from response timing.
 * The number of users is not treated as a secret.
 */
export function authorizePlannerUser(
  request: Request,
  users: readonly PlannerUser[],
): PlannerIdentity {
  const presented = bearerToken(request);
  if (!presented || presented.length < MIN_TOKEN_LENGTH) throw unauthorized();

  const digest = hashAccessToken(presented);
  let found: PlannerUser | null = null;
  for (const user of users) {
    // No early exit: the loop runs the same way whether or not it has matched.
    if (digestsEqual(user.tokenHash, digest)) found = user;
  }

  if (!found) throw unauthorized();
  return { userId: found.id, handle: found.handle };
}
