import { cookies } from 'next/headers';
import { ContentError } from '@/server/content/errors';
import { daysUntil, pickContinueTrip, vietnamToday } from '@/lib/home/continue-trip';
import { SESSION_COOKIE } from './auth';
import { getPlannerRepository } from './instance';
import type { PlannerRepository } from './repository';
import type { Trip } from './schemas';

/**
 * What the home page needs to know about the visitor (ADR 0021,
 * docs/specs-home-mvp.md). Read on the server, for `/` only — the layout, the
 * header and the page metadata never touch request data.
 *
 * - `guest`: no cookie, an invalid or expired session, a pending password
 *   change, or any failure while reading. The page is then exactly the public
 *   one, so a crawler and a signed-out visitor see the same document.
 * - `first-trip`: signed in, no trip at all.
 * - `next-trip`: signed in, no unfinished trip (all done, or all archived).
 * - `continue`: signed in, with an unfinished trip to carry on with.
 */
export type HomeMember =
  | { status: 'guest' }
  | { status: 'first-trip' }
  | { status: 'next-trip' }
  | { status: 'continue'; trip: ContinueTrip };

/**
 * The allow-list. Nothing else of a trip reaches the component: not the owner,
 * the share token, the note, the budget or the version.
 */
export interface ContinueTrip {
  id: string;
  title: string;
  destinationSlug: string;
  durationDays: number;
  startDate: string | null;
  /** Calendar days to departure in Vietnam; `null` with no date or once past. */
  daysUntilStart: number | null;
  planningStatus: Trip['planningStatus'];
}

const GUEST: HomeMember = { status: 'guest' };

function toContinueTrip(trip: Trip, today: string): ContinueTrip {
  const days = trip.startDate ? daysUntil(trip.startDate, today) : null;
  return {
    id: trip.id,
    title: trip.title,
    destinationSlug: trip.destinationSlug,
    durationDays: trip.durationDays,
    startDate: trip.startDate,
    daysUntilStart: days !== null && days >= 0 ? days : null,
    planningStatus: trip.planningStatus,
  };
}

/**
 * The decision itself, apart from Next's request APIs so it can be tested with
 * an in-memory repository. Only the cookie is forwarded to `identify`: no
 * `Authorization` header can reach it from here.
 */
export async function resolveHomeMember(
  repository: Pick<PlannerRepository, 'identify' | 'listTrips'>,
  sessionToken: string | null,
  now: Date,
): Promise<HomeMember> {
  if (!sessionToken) return GUEST;

  try {
    const request = new Request('http://home-page.internal/', {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
    });
    const identity = await repository.identify(request);
    if (identity.source !== 'cookie' || identity.passwordChangeRequired) return GUEST;

    const active = await repository.listTrips(identity.userId, { status: 'active', limit: 100 });
    const today = vietnamToday(now);
    const trip = pickContinueTrip(active, today);
    if (trip) return { status: 'continue', trip: toContinueTrip(trip, today) };
    if (active.length > 0) return { status: 'next-trip' };

    const archived = await repository.listTrips(identity.userId, { status: 'archived', limit: 1 });
    return { status: archived.length > 0 ? 'next-trip' : 'first-trip' };
  } catch (error) {
    // A stale or expired cookie is routine, not a fault. Anything else is
    // logged by name only — never the user, the token or a trip.
    if (!(error instanceof ContentError && error.code === 'unauthorized')) {
      console.error('[home] could not read the member', error instanceof Error ? error.name : 'error');
    }
    return GUEST;
  }
}

/** The signed-in visitor's home-page state, read from the session cookie. */
export async function readHomeMember(): Promise<HomeMember> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return GUEST;

  try {
    return await resolveHomeMember(await getPlannerRepository(), token, new Date());
  } catch (error) {
    console.error('[home] could not open the planner', error instanceof Error ? error.name : 'error');
    return GUEST;
  }
}
