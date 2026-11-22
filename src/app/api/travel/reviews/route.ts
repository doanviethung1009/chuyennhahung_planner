import { getRepository } from '@/server/content/instance';
import { toPublicReview } from '@/server/content/public';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    // The public shape is the allow-list shared with the story page (REVIEWS-API-PROJ); the raw record stays on the admin routes.
    const reviews = (await repository.listReviews({ ...query, status: 'published' })).map(toPublicReview);
    return jsonOk({ reviews, count: reviews.length });
  });
}
