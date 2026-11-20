import { cookies } from 'next/headers';
import { ContentError } from '@/server/content/errors';
import { SESSION_COOKIE } from './auth';
import { getPlannerRepository } from './instance';
import { allTrips } from './member-map';
import { buildPublicMemberMapPoints, type PublicMemberMapPoint } from './member-map-share';
import type { PlannerRepository } from './repository';

/** Same cheap shape filter as `member-map.ts`: a garbage cookie must not cost a store read. */
const SESSION_TOKEN_SHAPE = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * The exact public projection of the signed-in member's map (ADR 0030 §2), for
 * the preview on the member home (`/my-trips`). It goes through the same pure builder the public page
 * uses (`buildPublicMemberMapPoints`): completed trips only, archived or not,
 * destinations the catalogue knows, buckets 1 / 2–3 / 4+. Planned places and
 * review-only visits are not read. Returns `null` for a guest or on any failure,
 * so the page shows no controls and no preview rather than a wrong one.
 */
export async function resolveMemberMapSharePreview(
  repository: Pick<PlannerRepository, 'identify' | 'listTrips'>,
  sessionToken: string | null,
  knownSlugs: ReadonlySet<string>,
): Promise<PublicMemberMapPoint[] | null> {
  return (await resolveMemberMapShareOverview(repository, sessionToken, knownSlugs))?.points ?? null;
}

/**
 * The preview plus one number for the owner only (ADR 0032): how many of their
 * active trips are not `completed`, so the Sharing tab can say why a planned
 * place is not on the public map. A count, never a title, date or slug.
 */
export interface MemberMapShareOverview {
  points: PublicMemberMapPoint[];
  unfinishedTrips: number;
}

export async function resolveMemberMapShareOverview(
  repository: Pick<PlannerRepository, 'identify' | 'listTrips'>,
  sessionToken: string | null,
  knownSlugs: ReadonlySet<string>,
): Promise<MemberMapShareOverview | null> {
  if (!sessionToken || !SESSION_TOKEN_SHAPE.test(sessionToken)) return null;
  try {
    const request = new Request('http://member-map.internal/', {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
    });
    const identity = await repository.identify(request);
    if (identity.source !== 'cookie' || identity.passwordChangeRequired) return null;
    const [active, archived] = await Promise.all([
      allTrips(repository, identity.userId, 'active'),
      allTrips(repository, identity.userId, 'archived'),
    ]);
    return {
      points: buildPublicMemberMapPoints([...active, ...archived], identity.userId, (slug) =>
        knownSlugs.has(slug),
      ),
      unfinishedTrips: active.filter((trip) => trip.planningStatus !== 'completed').length,
    };
  } catch (error) {
    if (!(error instanceof ContentError && error.code === 'unauthorized')) {
      console.error('[member-map] could not build the share preview', error instanceof Error ? error.name : 'error');
    }
    return null;
  }
}

/** The signed-in visitor's share preview, read from the session cookie. */
export async function getMemberMapShareOverview(
  knownSlugs: ReadonlySet<string>,
): Promise<MemberMapShareOverview | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !SESSION_TOKEN_SHAPE.test(token)) return null;
  try {
    return await resolveMemberMapShareOverview(await getPlannerRepository(), token, knownSlugs);
  } catch {
    return null;
  }
}
