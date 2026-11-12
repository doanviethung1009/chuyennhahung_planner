import { stories as staticStories } from '@/content/stories';
import type { Story } from '@/content/types';
import type { TravelContentRepository } from '@/server/content/repository';
import { isContentError } from '@/server/content/repository';
import { storyCreateSchema, type StoryCreateInput } from '@/server/content/schemas';

/**
 * Maps the typed seed in `src/content/stories.ts` onto content-repository stories
 * so the seven existing stories survive the move to the repository
 * (ADR 0012 decision 7).
 */

/** Pure: no clock, no I/O. Throws if the vi and en paragraph counts differ. */
export function staticStoryToInput(story: Story): StoryCreateInput {
  if (story.body.vi.length !== story.body.en.length) {
    throw new Error(
      `static story "${story.slug}": vi has ${story.body.vi.length} paragraphs, en has ${story.body.en.length}`,
    );
  }
  return storyCreateSchema.parse({
    slug: story.slug,
    title: story.title,
    excerpt: story.excerpt,
    content: story.body.vi.map((vi, index) => ({
      type: 'paragraph',
      text: { vi, en: story.body.en[index] as string },
    })),
    cover: story.cover,
    destinationSlug: story.destinationSlugs[0] ?? null,
    plannerTemplateSlug: story.plannerTemplateSlug ?? null,
    // OWNER: these are NOT the real trip dates. The typed seed only records the
    // publish date, so start = end = publishedAt until the owner supplies real
    // dates in the CMS (CLAUDE.md rule 8, ADR 0012 decision 7).
    travelDates: { start: story.publishedAt, end: story.publishedAt },
    readingMinutes: story.readingMinutes,
    seo: { description: story.excerpt },
  });
}

export function staticStoryPublishedAt(story: Story): string {
  return `${story.publishedAt}T00:00:00.000Z`;
}

export interface StaticSeedResult {
  created: string[];
  skipped: string[];
}

async function exists(repository: TravelContentRepository, slug: string): Promise<boolean> {
  try {
    await repository.getStory(slug);
    return true;
  } catch (error) {
    if (isContentError(error) && error.code === 'not_found') return false;
    throw error;
  }
}

/**
 * Create-only per slug: a slug already in the store is skipped and never updated,
 * so a CMS edit cannot be overwritten. With `dryRun` nothing is written.
 */
export async function seedStaticStories(
  repository: TravelContentRepository,
  options: { dryRun?: boolean; source?: readonly Story[] } = {},
): Promise<StaticSeedResult> {
  const result: StaticSeedResult = { created: [], skipped: [] };
  for (const story of options.source ?? staticStories) {
    const input = staticStoryToInput(story);
    if (await exists(repository, story.slug)) {
      result.skipped.push(story.slug);
      continue;
    }
    if (!options.dryRun) {
      await repository.createStory(input);
      await repository.setStoryStatus(story.slug, {
        action: 'publish',
        publishedAt: staticStoryPublishedAt(story),
      });
    }
    result.created.push(story.slug);
  }
  return result;
}
