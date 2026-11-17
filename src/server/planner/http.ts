import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeAdmin } from '@/server/content/auth';
import { ContentError, forbidden } from '@/server/content/errors';
import { toErrorResponse } from '@/server/content/http';
import { jsonSafe } from './money';
import { can, type Action, type Role } from '@/server/identity/permissions';
import { invalidateOverviewCacheAfter } from '@/server/overview-cache';
import { createRateLimiter } from '@/server/rate-limit';
import {
  SESSION_COOKIE,
  sessionTokenFromRequest,
  type CredentialSource,
  type PlannerIdentity,
} from './auth';
import { getPlannerRepository } from './instance';
import type { PlannerRepository, TripView } from './repository';
import { tripListQuerySchema } from './schemas';
import { isSecureRequest, ownOrigins } from '@/server/request-scheme';

/**
 * The HTTP boundary for the Planner. It reuses the content system's error
 * envelope and status mapping — one vocabulary for the whole API — and adds the
 * two things trips need that editorial content does not: an owner resolved from
 * the request, and optimistic concurrency through `ETag` / `If-Match`.
 */

/** Trip data is private and read-your-own-writes. Nothing here is cacheable. */
const NO_STORE = { 'cache-control': 'no-store' } as const;

/**
 * Every Planner response goes through `jsonSafe`, so the day a BIGINT-returning
 * driver appears under the repository, `JSON.stringify` cannot throw on a
 * `bigint` and cannot silently emit a string where a number was promised.
 */
export function plannerJson<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(jsonSafe(data), { status, headers: NO_STORE });
}

export function plannerNoContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

/**
 * A trip response carries its version as an `ETag`, which is the value the
 * client sends back in `If-Match` on the next mutation. The whole aggregate
 * shares one version, so an edit made against a stale read of a day, an
 * activity or an expense is caught just as surely as a stale read of the trip.
 */
export function tripResponse(view: TripView, status = 200): NextResponse {
  return NextResponse.json(jsonSafe(view), {
    status,
    headers: { ...NO_STORE, etag: `"${view.trip.version}"` },
  });
}

/**
 * Parses `If-Match`. Returns null when the header is absent — the repository
 * decides whether that is acceptable for the operation at hand, because only it
 * knows whether the write could overwrite somebody else's edit.
 *
 * `If-Match: *` means "any current version", which is an explicit opt-out of
 * the check rather than a missing header, so it is reported as such.
 */
export function ifMatchVersion(request: Request): number | null {
  const header = request.headers.get('if-match');
  if (!header) return null;

  const value = header.trim();
  if (value === '*') return null;

  const parsed = Number(value.replace(/^W\//, '').replace(/^"|"$/g, '').trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ContentError(
      'bad_request',
      'If-Match must be a quoted trip version, for example: If-Match: "3"',
    );
  }
  return parsed;
}

export function parseTripListQuery(request: Request): z.infer<typeof tripListQuerySchema> {
  const params = new URL(request.url).searchParams;
  const raw: Record<string, string> = {};
  for (const key of ['status', 'destinationSlug', 'limit', 'offset']) {
    const value = params.get(key);
    if (value !== null && value !== '') raw[key] = value;
  }
  return tripListQuerySchema.parse(raw);
}

/**
 * Requests that cannot change anything, and so cannot be a CSRF target.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The same-origin requirement that cookie authentication brings with it
 * (ADR 0004 §4).
 *
 * A bearer token is only ever attached deliberately. A cookie is attached by
 * the browser to *any* request to our origin, including one a different site
 * caused, so a mutation authenticated by cookie has to prove where it came
 * from. Two rules, applied to every mutating request:
 *
 * 1. If the request states its origin — `Sec-Fetch-Site`, or `Origin` — that
 *    statement must say same-origin. This also covers sign-in, where there is
 *    no cookie yet but a cross-site POST could otherwise fixate a session.
 * 2. If it is authenticated *by cookie*, it must state its origin at all. A
 *    browser always does for a non-GET; something that does not is not a
 *    browser, and it should be using the token instead.
 *
 * `SameSite=Lax` on the cookie is a second line, not this one: it is browser
 * behaviour, and the server does not get to assume the client enforces it.
 */
function requireSameOrigin(request: Request, source: CredentialSource | null): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;

  const fetchSite = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');

  if (fetchSite !== null) {
    if (fetchSite !== 'same-origin') {
      throw forbidden(
        `a cross-site ${request.method} is refused`,
      );
    }
    return;
  }

  if (origin !== null) {
    let stated: string;
    try {
      stated = new URL(origin).origin;
    } catch {
      throw forbidden('the Origin header is not a valid origin');
    }
    if (!ownOrigins(request).has(stated)) {
      throw forbidden(`a cross-site ${request.method} is refused`);
    }
    return;
  }

  if (source === 'cookie') {
    throw forbidden(
      `a cookie-authenticated ${request.method} must send Origin or Sec-Fetch-Site`,
    );
  }
}

/**
 * Attaches the session cookie. `Secure` follows the browser's scheme so a
 * plain-http dev server still works; behind a TLS-terminating proxy that scheme
 * comes from `X-Forwarded-Proto`, trusted only with `TRUST_PROXY_HEADERS=true`
 * (`src/server/request-scheme.ts`). `HttpOnly` is unconditional — the browser must never be able to
 * read this value, which is the whole reason it is a cookie and not a token in
 * `localStorage`.
 */
export function setSessionCookie(
  response: NextResponse,
  request: Request,
  token: string,
  expiresAt: string,
): NextResponse {
  const secondsLeft = Math.max(
    0,
    Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  );
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: secondsLeft,
  });
  return response;
}

/** Clears the cookie on sign-out, with the same attributes it was set with. */
export function clearSessionCookie(
  response: NextResponse,
  request: Request,
): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

type PlannerHandler = (
  identity: PlannerIdentity,
  repository: PlannerRepository,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a traveller-facing route: resolve the repository, authenticate the
 * request to an owner, enforce the same-origin rule, then run.
 *
 * All three happen here and not in the handlers, deliberately. Authentication
 * is not something an individual route can forget, the handler receives the
 * owner id rather than reading it from the payload — a request cannot name
 * whose trips it wants — and a route that forgot the origin check would be a
 * real CSRF hole rather than a cosmetic gap, so no route is given the chance.
 */
export async function plannerRoute(
  request: Request,
  handler: PlannerHandler,
  options: { allowPendingPasswordChange?: boolean } = {},
): Promise<NextResponse> {
  try {
    const repository = await getPlannerRepository();
    const identity = await repository.identify(request);
    requireSameOrigin(request, identity.source);
    // The temporary-password gate (ADR 0007): a session opened with an
    // operator-issued password reaches nothing but "who am I", sign-out and
    // the change itself until the password is changed.
    if (identity.passwordChangeRequired && !options.allowPendingPasswordChange) {
      throw new ContentError(
        'password_change_required',
        'change the temporary password at POST /api/planner/password first',
      );
    }
    return await handler(identity, repository);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Wraps the sign-in and sign-out routes, which cannot authenticate first —
 * signing in is how you get a credential. The origin rule still applies: a
 * cross-site POST here could otherwise hand a victim's browser a session
 * belonging to the attacker.
 */
export async function plannerSessionRoute(
  request: Request,
  handler: (repository: Awaited<ReturnType<typeof getPlannerRepository>>) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    requireSameOrigin(request, null);
    const repository = await getPlannerRepository();
    return await handler(repository);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Who is behind an admin call (ADR 0010). */
export type AdminPrincipal =
  | { kind: 'service' }
  | { kind: 'session'; userId: string; handle: string; role: Role };

type AdminPlannerHandler = (
  repository: PlannerRepository,
  principal: AdminPrincipal,
) => Promise<NextResponse> | NextResponse;

export interface AdminRouteOptions {
  /** The permission the route needs; checked with `can()` for every principal. */
  action: Action;
  /**
   * Opt in to browser-session admins. Off by default: a route must name itself
   * (ADR 0010 §2). Without it, only the service token passes.
   */
  session?: boolean;
}

/** Session admin mutations: 30 per minute per user (ADR 0010 §8). Per process. */
/**
 * Kept on `globalThis` so every copy of this module Next.js loads in one
 * process (page and route-handler bundles) draws from one budget, as the JSON
 * store does (ADR 0010).
 */
const ADMIN_LIMITER_KEY = Symbol.for('chuyennhahung.adminSessionLimiter');
export const adminSessionLimiter: ReturnType<typeof createRateLimiter> = ((
  globalThis as typeof globalThis & {
    [ADMIN_LIMITER_KEY]?: ReturnType<typeof createRateLimiter>;
  }
)[ADMIN_LIMITER_KEY] ??= createRateLimiter({ limit: 30, windowMs: 60_000 }));

const ADMIN_NO_STORE = (response: NextResponse): NextResponse => {
  response.headers.set('cache-control', 'no-store');
  return response;
};

/**
 * Wraps an admin route. Provisioning travellers is an operator action.
 *
 * Principal resolution (ADR 0010 §1), in order:
 * 1. An `Authorization` header is present: only `ADMIN_API_TOKEN` is accepted.
 *    A traveller's own access token is *not* an admin credential.
 * 2. Otherwise, if the route opted in with `session: true`, the session cookie:
 *    same-origin proof, role re-read from the store, no pending temporary
 *    password, `can(role, action)`, then a per-user rate limit on mutations.
 *
 * The service token still cannot read or edit a trip (ADR 0002 §3).
 * Calling with just a handler keeps the token-only behaviour of every route
 * that has not opted in.
 */
export async function adminPlannerRoute(
  request: Request,
  handler: AdminPlannerHandler,
): Promise<NextResponse>;
export async function adminPlannerRoute(
  request: Request,
  options: AdminRouteOptions,
  handler: AdminPlannerHandler,
): Promise<NextResponse>;
export async function adminPlannerRoute(
  request: Request,
  second: AdminRouteOptions | AdminPlannerHandler,
  third?: AdminPlannerHandler,
): Promise<NextResponse> {
  const options: AdminRouteOptions =
    typeof second === 'function' ? { action: 'user:provision' } : second;
  const handler = typeof second === 'function' ? second : third;
  try {
    if (!handler) throw new Error('adminPlannerRoute needs a handler');
    const principal = await resolveAdminPrincipal(request, options);
    const repository = await getPlannerRepository();
    return ADMIN_NO_STORE(await handler(repository, principal));
  } catch (error) {
    return ADMIN_NO_STORE(toErrorResponse(error));
  } finally {
    invalidateOverviewCacheAfter(request);
  }
}

export async function resolveAdminPrincipal(
  request: Request,
  options: AdminRouteOptions,
): Promise<AdminPrincipal> {
  // Present at all => the caller chose the token path; never fall through to a
  // cookie, and never accept anything but the service token.
  if (request.headers.get('authorization') !== null || !options.session) {
    authorizeAdmin(request);
    if (!can({ role: 'service' }, options.action)) throw forbidden('this action is not permitted');
    return { kind: 'service' };
  }

  if (sessionTokenFromRequest(request) === null) {
    authorizeAdmin(request); // throws the usual 401 / 503
    throw new ContentError('unauthorized', 'sign in as an admin, or send the admin token');
  }

  // A cookie rides along on cross-site requests; prove origin before anything
  // is read or written.
  requireSameOrigin(request, 'cookie');
  const repository = await getPlannerRepository();
  const identity = await repository.identify(request);
  if (identity.source !== 'cookie') {
    throw new ContentError('unauthorized', 'a signed-in admin session is required');
  }
  if (identity.passwordChangeRequired) {
    throw new ContentError(
      'password_change_required',
      'change the temporary password at POST /api/planner/password first',
    );
  }
  if (!can({ role: identity.role }, options.action)) {
    throw forbidden('this account is not permitted to do that');
  }
  if (!SAFE_METHODS.has(request.method.toUpperCase())) {
    const verdict = adminSessionLimiter.check(identity.userId);
    if (!verdict.ok) {
      throw new ContentError(
        'rate_limited',
        'too many admin changes; wait a moment and try again',
        [],
        verdict.retryAfterSeconds,
      );
    }
  }
  return { kind: 'session', userId: identity.userId, handle: identity.handle, role: identity.role };
}
