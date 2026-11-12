import { adminContentRoute } from '@/server/admin/content-route';
import {
  adminRoute,
  jsonCreated,
  jsonOk,
  parseJsonBody,
  parseListQuery,
} from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { reviewCreateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const repository = await getRepository();
    const reviews = await repository.listReviews(parseListQuery(request));
    return jsonOk({ reviews, count: reviews.length });
  });
}

export function POST(request: Request) {
  return adminRoute(request, async () => {
    const input = await parseJsonBody(request, reviewCreateSchema);
    const repository = await getRepository();
    return jsonCreated(await repository.createReview(input));
  });
}
