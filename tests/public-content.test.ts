import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stories as staticStories } from '../src/content/stories';
import type { TravelContentRepository } from '../src/server/content/repository';
import {
  createRepositoryPublicContent,
  getPublicContent,
  publicContentSource,
} from '../src/server/content/public';
import {
  bilingual,
  makeRepository,
  placeFixture,
  reviewFixture,
  storyFixture,
  templateFixture,
} from './travel-content-helpers';

const repositoryForEnv = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../src/server/content/instance', () => ({
  getRepository: () => Promise.resolve(repositoryForEnv.current),
}));

let repo: TravelContentRepository;
const content = () => createRepositoryPublicContent(() => Promise.resolve(repo));

async function publish(slug: string, publishedAt?: string, extra = {}) {
  await repo.createStory(storyFixture({ slug, ...extra }));
  await repo.setStoryStatus(slug, { action: 'publish', ...(publishedAt ? { publishedAt } : {}) });
}

beforeEach(() => {
  repo = makeRepository();
  repositoryForEnv.current = repo;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('visibility', () => {
  it('returns null for draft, archived and unknown slugs', async () => {
    await repo.createStory(storyFixture({ slug: 'draft-story' }));
    await publish('archived-story');
    await repo.setStoryStatus('archived-story', { action: 'archive' });
    await publish('live-story');

    const c = content();
    expect(await c.getStory('draft-story')).toBeNull();
    expect(await c.getStory('archived-story')).toBeNull();
    expect(await c.getStory('no-such-story')).toBeNull();
    expect((await c.getStory('live-story'))?.slug).toBe('live-story');
  });

  it('lists published stories only, newest publishedAt first, slug as tiebreak', async () => {
    await publish('b-story', '2026-01-10T00:00:00.000Z');
    await publish('a-story', '2026-01-10T00:00:00.000Z');
    await publish('newest', '2026-02-01T00:00:00.000Z');
    await publish('oldest', '2025-12-01T00:00:00.000Z');
    await repo.createStory(storyFixture({ slug: 'a-draft' }));

    const slugs = (await content().listStories()).map((s) => s.slug);
    expect(slugs).toEqual(['newest', 'a-story', 'b-story', 'oldest']);
  });

  it('exposes the UTC date and the ISO instant', async () => {
    await publish('dated', '2026-01-10T23:30:00.000Z');
    const story = await content().getStory('dated');
    expect(story?.publishedAt).toBe('2026-01-10');
    expect(story?.publishedAtIso).toBe('2026-01-10T23:30:00.000Z');
  });

  it('filters by destination, and a null destination maps to []', async () => {
    await publish('in-da-lat');
    await publish('nowhere', undefined, { destinationSlug: null });
    const c = content();
    expect((await c.listStoriesForDestination('da-lat')).map((s) => s.slug)).toEqual(['in-da-lat']);
    expect((await c.getStory('nowhere'))?.destinationSlugs).toEqual([]);
    expect((await c.getStory('in-da-lat'))?.destinationSlugs).toEqual(['da-lat']);
  });
});

describe('places and reviews', () => {
  it('a place used only by a draft story is not returned anywhere', async () => {
    await repo.createPlace(placeFixture({ slug: 'secret-place' }));
    await repo.createStory(storyFixture({ slug: 'draft-story', placeSlugs: ['secret-place'] }));
    await publish('live-story');

    const c = content();
    expect(await c.getStory('draft-story')).toBeNull();
    const all = await c.listStories();
    expect(all.flatMap((s) => s.places)).toEqual([]);
  });

  it('returns places referenced by placeSlugs and place blocks', async () => {
    await repo.createPlace(placeFixture({ slug: 'place-one' }));
    await repo.createPlace(placeFixture({ slug: 'place-two' }));
    await publish('with-places', undefined, {
      placeSlugs: ['place-one', 'place-two'],
      content: [
        { type: 'paragraph', text: bilingual('Một.', 'One.') },
        { type: 'place', placeSlug: 'place-two', note: null },
      ],
    });
    const story = await content().getStory('with-places');
    expect(story?.places.map((p) => p.slug).sort()).toEqual(['place-one', 'place-two']);
    expect(story?.blocks).toHaveLength(2);
  });

  it('never returns an unpublished review', async () => {
    await repo.createReview(reviewFixture({ id: 'review-live' }));
    await repo.setReviewStatus('review-live', { action: 'publish' });
    await repo.createReview(reviewFixture({ id: 'review-draft' }));
    await repo.createStory(storyFixture({ slug: 'with-reviews', reviewIds: ['review-live'] }));
    await repo.setStoryStatus('with-reviews', { action: 'publish' });

    // The repository will not let a published story link a draft review, so
    // exercise the defence-in-depth filter by returning such a story from the read.
    const real = repo.getStory.bind(repo);
    vi.spyOn(repo, 'getStory').mockImplementation(async (slug: string) => ({
      ...(await real(slug)),
      reviewIds: ['review-live', 'review-draft'],
    }));

    const story = await content().getStory('with-reviews');
    expect(story?.reviews.map((r) => r.id)).toEqual(['review-live']);
  });

  it('omits a place slug that no longer resolves, and does not throw', async () => {
    await repo.createPlace(placeFixture({ slug: 'vanishing' }));
    await publish('has-ghost', undefined, { placeSlugs: ['vanishing'] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = repo.getPlace.bind(repo);
    vi.spyOn(repo, 'getPlace').mockImplementation(async (slug: string) => {
      if (slug === 'vanishing') return original('ghost-place-not-there');
      return original(slug);
    });
    const story = await content().getStory('has-ghost');
    expect(story?.places).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});

describe('plannerTemplateSlug', () => {
  it('is kept when the template is public', async () => {
    await publish('source', undefined, { plannerTemplateSlug: 'test-template' });
    await repo.createTemplate(templateFixture({ sourceStorySlug: 'source', visibility: 'public' }));
    expect((await content().getStory('source'))?.plannerTemplateSlug).toBe('test-template');
  });

  it('is null when the template is private', async () => {
    await publish('source', undefined, { plannerTemplateSlug: 'test-template' });
    await repo.createTemplate(templateFixture({ sourceStorySlug: 'source', visibility: 'private' }));
    expect((await content().getStory('source'))?.plannerTemplateSlug).toBeNull();
  });

  it('is null when the template is missing, or the story never set one', async () => {
    await publish('dangling', undefined, { plannerTemplateSlug: 'ghost-template' });
    await publish('plain');
    const c = content();
    expect((await c.getStory('dangling'))?.plannerTemplateSlug).toBeNull();
    expect((await c.getStory('plain'))?.plannerTemplateSlug).toBeNull();
  });
});

describe('seo and sitemap', () => {
  it('resolves seo with fallbacks and honours noindex in the sitemap', async () => {
    await publish('indexed');
    await publish('hidden', undefined, {
      seo: { ...storyFixture().seo, noindex: true, ogImage: '/images/covers/da-lat.svg' },
    });
    await repo.createStory(storyFixture({ slug: 'unpublished' }));

    const c = content();
    const indexed = await c.getStory('indexed');
    expect(indexed?.seo.title).toEqual(indexed?.title);
    expect(indexed?.seo.ogImage).toBe(indexed?.cover);
    expect((await c.getStory('hidden'))?.seo.noindex).toBe(true);
    expect((await c.getStory('hidden'))?.seo.ogImage).toBe('/images/covers/da-lat.svg');

    const entries = await c.listSitemapEntries();
    expect(entries.map((e) => e.slug)).toEqual(['indexed']);
    expect(entries[0]?.updatedAt).toBe('2026-03-01T08:00:00.000Z');
  });
});

describe('failure and source selection', () => {
  it('rejects when the store fails, with no fallback to the static seed', async () => {
    const failing = createRepositoryPublicContent(() => Promise.reject(new Error('store down')));
    await expect(failing.listStories()).rejects.toThrow('store down');
    await expect(failing.getStory('anything')).rejects.toThrow('store down');
    await expect(failing.listSitemapEntries()).rejects.toThrow('store down');
  });

  it('defaults to the repository and treats unknown values as the default', async () => {
    vi.stubEnv('PUBLIC_CONTENT_SOURCE', '');
    expect(publicContentSource()).toBe('repository');
    vi.stubEnv('PUBLIC_CONTENT_SOURCE', 'nonsense');
    expect(publicContentSource()).toBe('repository');
    await publish('only-in-repo');
    const c = await getPublicContent();
    expect((await c.listStories()).map((s) => s.slug)).toEqual(['only-in-repo']);
  });

  it('serves the static stories when PUBLIC_CONTENT_SOURCE=static, switching with no rebuild', async () => {
    await publish('only-in-repo');
    vi.stubEnv('PUBLIC_CONTENT_SOURCE', 'repository');
    expect((await (await getPublicContent()).listStories()).map((s) => s.slug)).toEqual(['only-in-repo']);

    vi.stubEnv('PUBLIC_CONTENT_SOURCE', 'static');
    const c = await getPublicContent();
    const listed = await c.listStories();
    expect(listed).toHaveLength(staticStories.length);
    expect(new Set(listed.map((s) => s.slug))).toEqual(new Set(staticStories.map((s) => s.slug)));
    expect(await c.getStory('only-in-repo')).toBeNull();
    expect((await c.getStory('di-da-lat-lan-thu-sau'))?.plannerTemplateSlug).toBe('da-lat-3-ngay-lang-man');
    expect(listed.map((s) => s.publishedAt)).toEqual([...listed.map((s) => s.publishedAt)].sort().reverse());
    expect((await c.listSitemapEntries()).length).toBe(staticStories.length);
  });
});
