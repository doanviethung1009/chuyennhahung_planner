import { adminContentRoute, ifMatchStamp } from '@/server/admin/content-route';
import { jsonOk, noContent, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { ContentError, placeInUse } from '@/server/content/errors';
import { getPlannerRepository } from '@/server/planner/instance';
import { placeUpdateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

export function GET(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    return jsonOk(await repository.getPlace(slug));
  });
}

export function PATCH(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { slug } = await context.params;
    const patch = await parseJsonBody(request, placeUpdateSchema);
    const repository = await getRepository();
    return jsonOk(await repository.updatePlace(slug, patch, ifMatchStamp(request)));
  });
}

/**
 * Refuses to delete a place anything still points at (CORE-9, decision 11).
 * Order: Planner counts (fail closed) -> content counts -> 409 or delete.
 * The two stores are not one transaction; `/api/admin/planner/integrity` is the
 * backstop for a trip that adds the place in between.
 */
export function DELETE(request: Request, context: Context) {
  // ADR 0028: the service token or an admin / super admin session (`content:delete`); editors are refused.
  return adminContentRoute(request, { action: 'content:delete', session: true }, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    const content = await repository.countPlaceReferences(slug); // 404 if unknown

    let planner: { tripActivities: number; communityReviews: number };
    try {
      planner = await (await getPlannerRepository()).countPlaceReferences(slug);
    } catch (error) {
      // Name only: a driver error can carry connection parameters.
      console.error(
        '[travel-content] planner usage check failed; place not deleted:',
        error instanceof Error ? error.name : 'unknown',
      );
      throw new ContentError(
        'service_unavailable',
        'could not verify that the place is unused; nothing was deleted',
      );
    }

    const counts = { ...content, ...planner };
    if (Object.values(counts).some((n) => n > 0)) throw placeInUse(counts);

    await repository.deletePlace(slug);
    return noContent();
  });
}
