import { timingSafeEqual } from 'node:crypto';
import { ContentError, notFound } from '@/server/content/errors';
import { toErrorResponse } from '@/server/content/http';
import {
  exchangeGoogleCode,
  googleConfig,
  googleRedirectUri,
  GoogleSignInError,
  hashState,
  verifyGoogleIdToken,
} from '@/server/planner/google';
import {
  clearStateCookie,
  redirectTo,
  redirectToAccount,
  redirectToSignIn,
  stateFromCookie,
  type GoogleErrorCode,
  type GoogleLinkStatus,
} from '@/server/planner/google-http';
import { setSessionCookie } from '@/server/planner/http';
import { getPlannerRepository } from '@/server/planner/instance';
import { allowSignup, clientKey } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Google's redirect back (ADR 0007). A cross-site top-level GET, so the
 * same-origin check cannot apply; the CSRF defence is the `state` in the query
 * matching the one in this browser's own cookie, and resolving to an attempt
 * that is consumed here whatever happens next.
 *
 * Then: exchange the code with the PKCE verifier, verify the `id_token`
 * completely, and resolve it to an account — matched or created. An attempt
 * started with `intent=link` instead attaches the Google account to the user
 * who started it, provided this browser is still signed in as that user.
 */
export async function GET(request: Request) {
  try {
    const config = googleConfig();
    if (!config) throw notFound('route', '/api/planner/oauth/google/callback');
    const repository = await getPlannerRepository();

    const params = new URL(request.url).searchParams;
    const queryState = params.get('state');
    const cookieState = stateFromCookie(request);

    // The attempt is consumed before anything else can fail, so a state is
    // never usable twice — including after a cancelled or failed sign-in.
    const attempt = queryState ? await repository.consumeGoogleAttempt(hashState(queryState)) : null;
    const locale = attempt?.locale ?? 'vi';

    if (!attempt || !queryState || !cookieState || !sameString(queryState, cookieState)) {
      console.warn('[planner] google sign-in refused: state missing, mismatched or expired');
      return redirectToSignIn(request, locale, 'google_failed', attempt?.returnTo);
    }
    const linkUserId = attempt.linkUserId;
    const fail = (code: GoogleErrorCode & GoogleLinkStatus) =>
      linkUserId
        ? redirectToAccount(request, locale, code)
        : redirectToSignIn(request, locale, code, attempt.returnTo);

    if (params.get('error')) return fail('google_cancelled');
    const code = params.get('code');
    if (!code) return fail('google_failed');

    let identity;
    try {
      const idToken = await exchangeGoogleCode(
        config,
        googleRedirectUri(config, request),
        code,
        attempt.codeVerifier,
      );
      identity = await verifyGoogleIdToken(idToken, {
        clientId: config.clientId,
        nonce: attempt.nonce,
      });
    } catch (error) {
      if (error instanceof GoogleSignInError) {
        console.warn(`[planner] google sign-in refused: ${error.message}`);
        return fail(error.code);
      }
      throw error;
    }

    if (linkUserId) {
      // The browser must still be signed in as the user who asked to link.
      let currentUserId: string | null = null;
      try {
        const current = await repository.identify(request);
        if (current.source === 'cookie') currentUserId = current.userId;
      } catch (error) {
        if (!(error instanceof ContentError && error.code === 'unauthorized')) throw error;
      }
      if (currentUserId !== linkUserId) {
        console.warn('[planner] google link refused: the session no longer matches the attempt');
        return redirectToSignIn(request, locale, 'google_failed', attempt.returnTo);
      }
      const linked = await repository.linkGoogle(linkUserId, identity);
      return redirectToAccount(request, locale, linked.ok ? 'linked' : linked.reason);
    }

    const key = clientKey(request.headers);
    const result = await repository.signInWithGoogle(identity, {
      signupEnabled: config.signupEnabled,
      allowSignup: () => allowSignup(key),
    });
    if (!result.ok) return redirectToSignIn(request, locale, result.reason, attempt.returnTo);

    const response = clearStateCookie(redirectTo(request, attempt.returnTo), request);
    return setSessionCookie(response, request, result.session.token, result.session.expiresAt);
  } catch (error) {
    return toErrorResponse(error);
  }
}
