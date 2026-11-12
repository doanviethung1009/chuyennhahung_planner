import { adminContentRoute } from '@/server/admin/content-route';
import {
  adminRoute,
  jsonCreated,
  jsonOk,
  parseJsonBody,
  parseListQuery,
} from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { storyCreateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const repository = await getRepository();
    // Unlike the public list, this returns drafts and archived stories too.
    const stories = await repository.listStories(parseListQuery(request));
    return jsonOk({ stories, count: stories.length });
  });
}

export function POST(request: Request) {
  return adminRoute(request, async () => {
    const input = await parseJsonBody(request, storyCreateSchema);
    const repository = await getRepository();
    // Always created as a draft — publishing is a separate, explicit call.
    return jsonCreated(await repository.createStory(input));
  });
}
