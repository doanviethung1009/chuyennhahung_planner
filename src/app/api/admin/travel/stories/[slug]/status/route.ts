import { adminContentRoute } from '@/server/admin/content-route';
import { jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { getPlannerRepository } from '@/server/planner/instance';
import { publishActionSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

/** `{ "action": "publish" | "unpublish" | "archive" }` */
export function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminContentRoute(request, { action: 'story:publish', session: true }, async (principal) => {
    const { slug } = await context.params;
    const action = await parseJsonBody(request, publishActionSchema);
    const repository = await getRepository();
    const before = await repository.getStory(slug);
    const story = await repository.setStoryStatus(slug, action);
    // One event per real change (P07-13). The story lives in the content store, so
    // this is a second write after it succeeded, not the same transaction.
    if (before.status !== story.status) {
      await (await getPlannerRepository()).recordAdminEvent({
        targetKind: 'story',
        targetId: slug,
        actorId: principal.kind === 'session' ? principal.userId : 'service',
        action: action.action,
        fromStatus: before.status,
        toStatus: story.status,
      });
    }
    return jsonOk(story);
  });
}
