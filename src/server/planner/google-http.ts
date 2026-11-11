import { NextResponse } from 'next/server';
import { pathnames, type Locale } from '@/i18n/routing';
import { safeReturnTo } from '@/lib/return-to';
import { OAUTH_COOKIE_PATH, OAUTH_STATE_COOKIE } from './google';
import { OAUTH_ATTEMPT_MINUTES } from './schemas';
import { isSecureRequest } from '@/server/request-scheme';

/**
 * HTTP plumbing for the two Google routes (ADR 0007): the state cookie and the
 * redirects. Both routes are top-level browser navigations, so every outcome
 * is a 302 — an error is a redirect to the sign-in page with a coarse code,
 * never a JSON body the visitor would see raw.
 */

/** The codes the sign-in page knows how to explain. */
export type GoogleErrorCode =
  | 'google_failed'
  | 'google_cancelled'
  | 'google_unverified'
  | 'account_not_found'
  | 'account_conflict'
  | 'link_required'
  | 'rate_limited';

/** What the account page is told after a link attempt (`?google=`). */
export type GoogleLinkStatus =
  | 'linked'
  | 'google_failed'
  | 'google_cancelled'
  | 'google_unverified'
  | 'account_conflict'
  | 'rate_limited';

const NO_STORE = { 'cache-control': 'no-store' } as const;

export function parseLocale(value: string | null): Locale {
  return value === 'en' ? 'en' : 'vi';
}

/**
 * Where redirects point. The public site URL when set — behind a proxy the
 * request's own URL may be an internal address — else the request origin.
 */
export function publicOrigin(request: Request): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return site ? new URL(site).origin : new URL(request.url).origin;
}

/** `/dang-nhap` or `/en/sign-in`, read from the route table. */
export function signInPath(locale: Locale): string {
  const path = pathnames['/sign-in'][locale];
  return locale === 'vi' ? path : `/${locale}${path}`;
}

/** `/doi-mat-khau` or `/en/account/password` — where Google is linked from. */
export function accountPath(locale: Locale): string {
  const path = pathnames['/account/password'][locale];
  return locale === 'vi' ? path : `/${locale}${path}`;
}

export function redirectTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, publicOrigin(request)), { status: 302, headers: NO_STORE });
}

export function redirectToSignIn(
  request: Request,
  locale: Locale,
  code: GoogleErrorCode,
  returnTo?: string,
): NextResponse {
  const query = new URLSearchParams({ error: code });
  if (returnTo) query.set('returnTo', safeReturnTo(returnTo));
  return clearStateCookie(redirectTo(request, `${signInPath(locale)}?${query.toString()}`), request);
}

/** Back to the account page after a link attempt, with its outcome. */
export function redirectToAccount(
  request: Request,
  locale: Locale,
  status?: GoogleLinkStatus,
): NextResponse {
  const query = status ? `?${new URLSearchParams({ google: status }).toString()}` : '';
  return clearStateCookie(redirectTo(request, `${accountPath(locale)}${query}`), request);
}

const secure = (request: Request) => isSecureRequest(request);

/**
 * Binds the attempt to this browser. `SameSite=Lax` is what lets the cookie
 * ride along on Google's top-level redirect back to us; the path keeps it off
 * every other request.
 */
export function setStateCookie(response: NextResponse, request: Request, state: string): NextResponse {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: secure(request),
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_ATTEMPT_MINUTES * 60,
  });
  return response;
}

export function clearStateCookie(response: NextResponse, request: Request): NextResponse {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: '',
    httpOnly: true,
    secure: secure(request),
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: 0,
  });
  return response;
}

export function stateFromCookie(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== OAUTH_STATE_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}
