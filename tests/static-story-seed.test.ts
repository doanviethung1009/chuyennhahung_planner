import { describe, expect, it, vi } from 'vitest';
import { stories } from '../src/content/stories';
import { seedTravelContent } from '../src/content/travel/seed';
import {
  seedStaticStories,
  staticStoryToInput,
} from '../src/content/travel/static-stories';
import { storyCreateSchema } from '../src/server/content/schemas';
import { makeRepository } from './travel-content-helpers';

describe('staticStoryToInput', () => {
  it('yields a schema-valid input for every static story', () => {
    expect(stories.length).toBeGreaterThan(0);
    for (const story of stories) {
      const input = staticStoryToInput(story);
      expect(storyCreateSchema.safeParse(input).success, story.slug).toBe(true);
      expect(input.slug).toBe(story.slug);
    }
  });

  it('keeps vi and en paragraph counts equal, and fails loudly when they differ', () => {
    for (const story of stories) {
      expect(story.body.vi.length, story.slug).toBe(story.body.en.length);
      expect(staticStoryToInput(story).content).toHaveLength(story.body.vi.length);
    }
    const [first] = stories;
    if (!first) throw new Error('no static story');
    const broken = { ...first, body: { vi: first.body.vi, en: first.body.en.slice(1) } };
    expect(() => staticStoryToInput(broken)).toThrow(/paragraphs/);
  });

  it('validates the destination-less stories with a null destination', () => {
    const without = stories.filter((s) => s.destinationSlugs.length === 0);
    expect(without.length).toBeGreaterThan(0);
    for (const story of without) {
      expect(staticStoryToInput(story).destinationSlug).toBeNull();
    }
  });

  it('keeps plannerTemplateSlug for di-da-lat-lan-thu-sau and null elsewhere', () => {
    for (const story of stories) {
      const expected = story.slug === 'di-da-lat-lan-thu-sau' ? 'da-lat-3-ngay-lang-man' : null;
      expect(staticStoryToInput(story).plannerTemplateSlug, story.slug).toBe(expected);
    }
  });

  it('uses the excerpt as the SEO description and the publish date as travel dates', () => {
    const story = stories[0];
    if (!story) throw new Error('no static story');
    const input = staticStoryToInput(story);
    expect(input.seo.description).toEqual(story.excerpt);
    expect(input.travelDates).toEqual({ start: story.publishedAt, end: story.publishedAt });
  });
});

describe('seedStaticStories', () => {
  it('creates every story published at its date, and nothing the second time', async () => {
    const repo = makeRepository();
    const first = await seedStaticStories(repo);
    expect(first.created).toHaveLength(stories.length);
    expect(first.skipped).toEqual([]);

    const sample = stories[0];
    if (!sample) throw new Error('no static story');
    const stored = await repo.getStory(sample.slug);
    expect(stored.status).toBe('published');
    expect(stored.publishedAt).toBe(`${sample.publishedAt}T00:00:00.000Z`);

    const second = await seedStaticStories(repo);
    expect(second.created).toEqual([]);
    expect(second.skipped).toHaveLength(stories.length);
    expect(await repo.listStories({ limit: 100 })).toHaveLength(stories.length);
  });

  it('does not overwrite an edited seeded story', async () => {
    const repo = makeRepository();
    await seedStaticStories(repo);
    const sample = stories[0];
    if (!sample) throw new Error('no static story');
    await repo.updateStory(sample.slug, { readingMinutes: 42 });

    await seedStaticStories(repo);
    expect((await repo.getStory(sample.slug)).readingMinutes).toBe(42);
  });

  it('writes nothing on a dry run, and reports what it would create', async () => {
    const repo = makeRepository();
    const write = vi.spyOn(repo, 'createStory');
    const result = await seedStaticStories(repo, { dryRun: true });
    expect(result.created).toHaveLength(stories.length);
    expect(write).not.toHaveBeenCalled();
    expect(await repo.listStories({ limit: 100 })).toEqual([]);
  });

  it('tops up an existing store without touching what is there', async () => {
    const repo = makeRepository();
    await seedTravelContent(repo);
    const before = (await repo.listStories({ limit: 100 })).length;
    expect(before).toBe(stories.length + 1);
    const result = await seedStaticStories(repo);
    expect(result.created).toEqual([]);
  });
});

describe('fresh store seeding', () => {
  it('seeds the static stories with the demo content', async () => {
    const repo = makeRepository();
    await seedTravelContent(repo);
    for (const story of stories) {
      expect((await repo.getStory(story.slug)).status).toBe('published');
    }
    expect((await repo.getStory('ba-ngay-lang-man-o-da-lat')).status).toBe('published');
  });

  it('boot does not recreate a deleted seeded story', async () => {
    const repo = makeRepository();
    await seedTravelContent(repo);
    const sample = stories[0];
    if (!sample) throw new Error('no static story');
    await repo.setStoryStatus(sample.slug, { action: 'unpublish' });
    await repo.deleteStory(sample.slug);

    await seedTravelContent(repo); // what a restart runs
    await expect(repo.getStory(sample.slug)).rejects.toMatchObject({ code: 'not_found' });
  });
});
