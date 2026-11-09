import { parseJsonBody } from '@/server/content/http';
import {
  clearSessionCookie,
  plannerJson,
  plannerNoContent,
  plannerSessionRoute,
  setSessionCookie,
} from '@/server/planner/http';
import { signInSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Signs in: exchanges the access token an operator issued for an `HttpOnly`
 * session cookie (ADR 0004 §2). The access token stays the root credential —
 * this is a revocable, expiring handle on it.
 *
 * The response body carries the user and the session's expiry, never the
 * cookie value: the browser gets that in `Set-Cookie`, where JavaScript cannot
 * reach it.
 */
export function POST(request: Request) {
  return plannerSessionRoute(request, async (repository) => {
    const { accessToken } = await parseJsonBody(request, signInSchema);
    const { user, token, expiresAt } = await repository.signIn(accessToken);
    return setSessionCookie(
      plannerJson({ user, expiresAt }, 201),
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
