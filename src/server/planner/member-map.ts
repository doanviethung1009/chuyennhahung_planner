import { cookies } from 'next/headers';
import { ContentError } from '@/server/content/errors';
import { getPublicPlaces } from '@/server/content/public-places';
import { SESSION_COOKIE } from './auth';
import { getPlannerRepository } from './instance';
import type { PlannerRepository } from './repository';
import type { OwnReview, Trip } from './schemas';

/**
 * What `/my-map` needs to know about the visitor (ADR 0029). Read on the
 * server, for that one page only, like `home-page.ts` does for `/`.
 *
 * - `guest`: no cookie, an invalid or expired session, a pending password
 *   change, or any failure while reading. The page then shows an empty map and
 *   an invitation to sign in — never anybody's data.
 * - `empty`: signed in, but nothing places a trip or a visit on the map yet.
 * - `ready`: signed in, with at least one point.
 */
export type MemberMapState =
  | { status: 'guest' }
  | { status: 'empty' }
  | { status: 'ready'; points: MemberMapPoint[] };

/**
 * The allow-list. Nothing else reaches the component: not the owner, a trip id,
 * a title, a note, a budget, a share token or a review's text. Name,
 * coordinates, `featured` and label side come from the content seed by `slug`.
 * No `visits` means "planned, not been yet" (a hollow dot).
 */
export interface MemberMapPoint {
  // Private page only: planned points and exact counts must never reach a public route.
  slug: string;
  visits?: number;
}

type TripFacts = Pick<Trip, 'destinationSlug' | 'status' | 'planningStatus' | 'startDate' | 'endDate'>;
type ReviewFacts = Pick<OwnReview, 'placeSlug' | 'visitedOn' | 'status'>;

/** Reviews a moderator turned down or removed say nothing about the member's own visit. */
const IGNORED_REVIEW_STATUS: ReadonlySet<OwnReview['status']> = new Set(['rejected', 'removed']);

const GUEST: MemberMapState = { status: 'guest' };

/** Cheap shape filter, as in `home-page.ts`: a garbage cookie must not cost a store read. */
const SESSION_TOKEN_SHAPE = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * The pure rule (ADR 0029), apart from every request API so it is tested alone.
 *
 * Per known destination:
 * - **visited** (solid dot, `visits` ≥ 1): a `completed` trip — archived or
 *   not — or a review of the member's own with a `visitedOn`;
 * - **planned** (hollow dot): an `active` `draft`/`planned` trip and nothing
 *   visited;
 * - an `archived` trip that is not `completed` is ignored.
 *
 * `visits` = completed trips + distinct `visitedOn` days that do not fall inside
 * a completed trip's own dates at the same destination (the same journey is not
 * counted twice). A destination missing from `knownSlugs` is dropped.
 */
export function buildMemberMapPoints(
  trips: readonly TripFacts[],
  reviews: readonly ReviewFacts[],
  placeDestination: ReadonlyMap<string, string>,
  knownSlugs: ReadonlySet<string>,
): MemberMapPoint[] {
  const completed = new Map<string, TripFacts[]>();
  const planned = new Set<string>();
  for (const trip of trips) {
    if (!knownSlugs.has(trip.destinationSlug)) continue;
    if (trip.planningStatus === 'completed') {
      completed.set(trip.destinationSlug, [...(completed.get(trip.destinationSlug) ?? []), trip]);
    } else if (trip.status === 'active') {
      planned.add(trip.destinationSlug);
    }
  }

  const visitDays = new Map<string, Set<string>>();
  for (const review of reviews) {
    if (IGNORED_REVIEW_STATUS.has(review.status)) continue;
    const slug = placeDestination.get(review.placeSlug);
    if (!slug || !knownSlugs.has(slug)) continue;
    const covered = (completed.get(slug) ?? []).some(
      (trip) =>
        trip.startDate !== null &&
        review.visitedOn >= trip.startDate &&
        review.visitedOn <= (trip.endDate ?? trip.startDate),
    );
    if (covered) continue;
    visitDays.set(slug, (visitDays.get(slug) ?? new Set()).add(review.visitedOn));
  }

  const points: MemberMapPoint[] = [];
  const slugs = new Set([...completed.keys(), ...visitDays.keys(), ...planned]);
  for (const slug of [...slugs].sort()) {
    const visits = (completed.get(slug)?.length ?? 0) + (visitDays.get(slug)?.size ?? 0);
    points.push(visits > 0 ? { slug, visits } : { slug });
  }
  return points;
}

/** Every trip the member owns in one status, paged: `listTrips` caps a page at 100. */
async function allTrips(
  repository: Pick<PlannerRepository, 'listTrips'>,
  ownerId: string,
  status: 'active' | 'archived',
): Promise<Trip[]> {
  const PAGE = 100;
  const MAX_PAGES = 10;
  const trips: Trip[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await repository.listTrips(ownerId, { status, limit: PAGE, offset: page * PAGE });
    trips.push(...batch);
    if (batch.length < PAGE) break;
  }
  return trips;
}

/**
 * The decision itself, apart from Next's request APIs so it can be tested with
 * an in-memory repository. Only the cookie is forwarded to `identify`; every
 * read is scoped to the identified `userId`.
 */
export async function resolveMemberMap(
  repository: Pick<PlannerRepository, 'identify' | 'listTrips' | 'listOwnReviews'>,
  sessionToken: string | null,
  placeDestination: ReadonlyMap<string, string>,
  knownSlugs: ReadonlySet<string>,
): Promise<MemberMapState> {
  if (!sessionToken || !SESSION_TOKEN_SHAPE.test(sessionToken)) return GUEST;

  try {
    const request = new Request('http://member-map.internal/', {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
    });
    const identity = await repository.identify(request);
    if (identity.source !== 'cookie' || identity.passwordChangeRequired) return GUEST;

    const [active, archived, reviews] = await Promise.all([
      allTrips(repository, identity.userId, 'active'),
      allTrips(repository, identity.userId, 'archived'),
      repository.listOwnReviews(identity.userId),
    ]);
    const points = buildMemberMapPoints([...active, ...archived], reviews, placeDestination, knownSlugs);
    return points.length > 0 ? { status: 'ready', points } : { status: 'empty' };
  } catch (error) {
    // A stale or expired cookie is routine. Anything else is logged by name only.
    if (!(error instanceof ContentError && error.code === 'unauthorized')) {
      console.error('[member-map] could not read the member', error instanceof Error ? error.name : 'error');
    }
    return GUEST;
  }
}

/** The signed-in visitor's map state, read from the session cookie. */
export async function getMemberMap(knownSlugs: ReadonlySet<string>): Promise<MemberMapState> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !SESSION_TOKEN_SHAPE.test(token)) return GUEST;

  try {
    const places = await getPublicPlaces();
    const placeDestination = new Map(places.map((place) => [place.slug, place.destinationSlug]));
    return await resolveMemberMap(await getPlannerRepository(), token, placeDestination, knownSlugs);
  } catch (error) {
    console.error('[member-map] could not open the planner', error instanceof Error ? error.name : 'error');
    return GUEST;
  }
}
