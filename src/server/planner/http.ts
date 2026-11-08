import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeAdmin } from '@/server/content/auth';
import { ContentError } from '@/server/content/errors';
import { toErrorResponse } from '@/server/content/http';
import { jsonSafe } from './money';
import type { PlannerIdentity } from './auth';
import { getPlannerRepository } from './instance';
import type { PlannerRepository, TripView } from './repository';
import { tripListQuerySchema } from './schemas';

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

type PlannerHandler = (
  identity: PlannerIdentity,
  repository: PlannerRepository,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a traveller-facing route: resolve the repository, authenticate the
 * bearer token to an owner, then run. Authentication is not something an
 * individual route can forget to do, and the handler receives the owner id
 * rather than reading it from the payload — a request cannot name whose trips
 * it wants to see.
 */
export async function plannerRoute(
  request: Request,
  handler: PlannerHandler,
): Promise<NextResponse> {
  try {
    const repository = await getPlannerRepository();
    const identity = await repository.identify(request);
    return await handler(identity, repository);
  } catch (error) {
    return toErrorResponse(error);
  }
}

type AdminPlannerHandler = (
  repository: PlannerRepository,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an admin route. Provisioning travellers is an operator action, so it
 * uses the existing `ADMIN_API_TOKEN` and fails closed exactly as the content
 * admin API does.
 *
 * Note what this does *not* grant: the admin token can create, list, rotate and
 * remove travellers, and cannot read or edit a single trip. Trip access needs
 * the traveller's own token (ADR 0002 §3).
 */
export async function adminPlannerRoute(
  request: Request,
  handler: AdminPlannerHandler,
): Promise<NextResponse> {
  try {
    authorizeAdmin(request);
    const repository = await getPlannerRepository();
    return await handler(repository);
  } catch (error) {
    return toErrorResponse(error);
  }
}
