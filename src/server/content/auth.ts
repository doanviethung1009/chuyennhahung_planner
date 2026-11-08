import { timingSafeEqual } from 'node:crypto';
import { ContentError } from './errors';

/**
 * Shortest token we will accept. A short `ADMIN_API_TOKEN` is treated as a
 * misconfiguration rather than a weak-but-usable secret, so a half-finished
 * `.env` can never leave the admin API guarded by "dev".
 */
const MIN_TOKEN_LENGTH = 32;

export interface AdminIdentity {
  /** No user table exists in this phase — the token itself is the principal. */
  principal: 'admin-token';
}

function configuredToken(): string | null {
  const token = process.env.ADMIN_API_TOKEN?.trim();
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;
  return token;
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  // `timingSafeEqual` throws outright on a length mismatch, so the lengths are
  // checked first. A dummy self-comparison keeps the work done on that path
  // similar to the real one; token length is not treated as a secret.
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
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
 * Authorizes an admin mutation, or throws. Fails closed: with no usable
 * `ADMIN_API_TOKEN` every admin route answers 503, never 200.
 */
export function authorizeAdmin(request: Request): AdminIdentity {
  const expected = configuredToken();
  if (!expected) {
    throw new ContentError(
      'admin_auth_unconfigured',
      'ADMIN_API_TOKEN is not set, or is shorter than 32 characters — the admin API is disabled',
    );
  }

  const presented = bearerToken(request);
  if (!presented || !equals(presented, expected)) {
    throw new ContentError(
      'unauthorized',
      'a valid "Authorization: Bearer <ADMIN_API_TOKEN>" header is required',
    );
  }

  return { principal: 'admin-token' };
}
