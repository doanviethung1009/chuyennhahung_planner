import { toErrorResponse } from '@/server/content/http';
import { ContentError, notFound } from '@/server/content/errors';
import { safeReturnTo } from '@/lib/return-to';
import {
  googleAuthorizeUrl,
  googleConfig,
  googleRedirectUri,
  hashState,
  newOAuthSecrets,
} from '@/server/planner/google';
import {
  parseLocale,
  redirectToAccount,
  redirectToSignIn,
  setStateCookie,
} from '@/server/planner/google-http';
import { getPlannerRepository } from '@/server/planner/instance';
import { clientKey, signInLimiter } from '@/server/rate-limit';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Starts "Sign in with Google" (ADR 0007): records a one-use attempt holding
 * the `nonce` and PKCE verifier, binds it to this browser with a cookie
 * carrying the raw `state`, and redirects to Google.
 *
 * With `intent=link` it starts *linking* instead: the caller must already be
 * signed in, and the attempt remembers who, so the callback attaches the
 * Google account to that user. This is the only way an existing account gains
 * a Google link — never by a matching email.
 *
 * 404 when Google is not configured — the route does not exist until the
 * owner supplies a client id and secret.
 */
export async function GET(request: Request) {
  try {
    const config = googleConfig();
    if (!config) throw notFound('route', '/api/planner/oauth/google/start');

    const params = new URL(request.url).searchParams;
    const locale = parseLocale(params.get('locale'));
    const linking = params.get('intent') === 'link';
    const returnTo = linking ? '/account/password' : safeReturnTo(params.get('returnTo'));
    const refuse = () =>
      linking
        ? redirectToAccount(request, locale, 'rate_limited')
        : redirectToSignIn(request, locale, 'rate_limited', returnTo);

    // Each start writes a row, so it shares the sign-in bucket.
    if (!signInLimiter.check(clientKey(request.headers)).ok) return refuse();

    const repository = await getPlannerRepository();
    let linkUserId: string | undefined;
    if (linking) {
      try {
        const identity = await repository.identify(request);
        // A temporary password is changed before anything else, linking included.
        if (identity.source !== 'cookie' || identity.passwordChangeRequired) {
          return redirectToAccount(request, locale);
        }
        linkUserId = identity.userId;
      } catch (error) {
        if (error instanceof ContentError && error.code === 'unauthorized') {
          return redirectToSignIn(request, locale, 'google_failed', returnTo);
        }
        throw error;
      }
    }

    const secrets = newOAuthSecrets();
    const recorded = await repository.beginGoogleSignIn({
      stateHash: hashState(secrets.state),
      nonce: secrets.nonce,
      codeVerifier: secrets.codeVerifier,
      returnTo,
      locale,
      ...(linkUserId ? { linkUserId } : {}),
    });
    if (!recorded) return refuse();

    const target = googleAuthorizeUrl(config, googleRedirectUri(config, request), secrets);
    const response = NextResponse.redirect(target, { status: 302, headers: { 'cache-control': 'no-store' } });
    return setStateCookie(response, request, secrets.state);
  } catch (error) {
    return toErrorResponse(error);
  }
}
