import { rateLimited } from '@/server/content/errors';
import { parseJsonBody } from '@/server/content/http';
import {
  clearSessionCookie,
  plannerJson,
  plannerNoContent,
  plannerRoute,
  plannerSessionRoute,
  setSessionCookie,
} from '@/server/planner/http';
import { signInSchema } from '@/server/planner/schemas';
import { clientKey, signInAccountLimiter, signInLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Signs in, with either the access token an operator issued (ADR 0004 §2) or
 * an email or account handle and a password (ADR 0007, 0018), and sets an `HttpOnly` session cookie.
 * `passwordChangeRequired` tells the browser to send the user to the
 * change-password page before anything else will answer.
 *
 * The response body carries the user and the session's expiry, never the
 * cookie value: the browser gets that in `Set-Cookie`, where JavaScript cannot
 * reach it.
 */
export function POST(request: Request) {
  return plannerSessionRoute(request, async (repository) => {
    const limit = signInLimiter.check(clientKey(request.headers));
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
    const input = await parseJsonBody(request, signInSchema);

    if ('accessToken' in input) {
      const { user, token, expiresAt } = await repository.signIn(input.accessToken);
      return setSessionCookie(
        plannerJson({ user, expiresAt, passwordChangeRequired: false }, 201),
        request,
        token,
        expiresAt,
      );
    }

    // A second bucket per account, so guessing one password from many
    // addresses is slowed too (ADR 0007). It throttles; it never locks.
    const perAccount = signInAccountLimiter.check(await repository.signInBucketKey(input.identifier));
    if (!perAccount.ok) throw rateLimited(perAccount.retryAfterSeconds);

    const { user, token, expiresAt } = await repository.signInWithPassword(
      input.identifier,
      input.password,
    );
    return setSessionCookie(
      plannerJson({ user, expiresAt, passwordChangeRequired: user.mustChangePassword === true }, 201),
      request,
      token,
      expiresAt,
    );
  });
}

/**
 * Signs out: deletes the session row and clears the cookie. Idempotent — with
 * no cookie, or one already gone, it still answers 204, because a client
 * retrying a sign-out must not be told it failed.
 */
export function DELETE(request: Request) {
  return plannerSessionRoute(request, async (repository) => {
    await repository.signOut(request);
    return clearSessionCookie(plannerNoContent(), request);
  });
}

/**
 * Who am I? Works with the session cookie or a bearer token, and answers 401
 * with neither. The body is the user and the session's expiry (null for a
 * bearer token, which has none) — never a credential.
 */
export function GET(request: Request) {
  return plannerRoute(
    request,
    async ({ userId }, repository) => {
      const { user, expiresAt, passwordChangeRequired } = await repository.describeSession(
        request,
        userId,
      );
      return plannerJson({ user, expiresAt, passwordChangeRequired });
    },
    { allowPendingPasswordChange: true },
  );
}
