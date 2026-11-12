import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentCatalog } from '../src/server/planner/catalog';
import { makeOwner, makePlanner } from './planner-helpers';
import { makeRepository, storyFixture, templateFixture } from './travel-content-helpers';

afterEach(() => vi.unstubAllEnvs());

async function repoWithTemplate(storyOverrides = {}) {
  const repo = makeRepository();
  await repo.createStory(storyFixture({ plannerTemplateSlug: 'test-template', ...storyOverrides }));
  await repo.setStoryStatus('test-story', { action: 'publish' });
  await repo.createTemplate(templateFixture({ visibility: 'public' }));
  return repo;
}

describe('linked story lookup reads the public content module', () => {
  it('returns the published CMS story whose plannerTemplateSlug is the template', async () => {
    const repo = await repoWithTemplate();
    const linked = await createContentCatalog(repo).getLinkedStory('test-template');
    expect(linked).toEqual({ slug: 'test-story', title: { vi: 'Chuyện thử', en: 'Test story' } });
  });

  it('does not link a draft story', async () => {
    const repo = makeRepository();
    await repo.createStory(storyFixture({ plannerTemplateSlug: 'test-template' }));
    await repo.createTemplate(templateFixture({ visibility: 'private' }));
    expect(await createContentCatalog(repo).getLinkedStory('test-template')).toBeNull();
  });

  it('does not link an archived story, nor when no story points at the template', async () => {
    const repo = await repoWithTemplate();
    expect(await createContentCatalog(repo).getLinkedStory('some-other-template')).toBeNull();
    await repo.updateTemplate('test-template', { visibility: 'private' });
    await repo.setStoryStatus('test-story', { action: 'archive' });
    expect(await createContentCatalog(repo).getLinkedStory('test-template')).toBeNull();
  });

  it('follows a CMS edit of plannerTemplateSlug', async () => {
    const repo = await repoWithTemplate();
    await repo.updateStory('test-story', { plannerTemplateSlug: null });
    expect(await createContentCatalog(repo).getLinkedStory('test-template')).toBeNull();
  });

  it('uses the static stories when PUBLIC_CONTENT_SOURCE=static', async () => {
    vi.stubEnv('PUBLIC_CONTENT_SOURCE', 'static');
    const linked = await createContentCatalog(makeRepository()).getLinkedStory('da-lat-3-ngay-lang-man');
    expect(linked?.slug).toBe('di-da-lat-lan-thu-sau');
  });

  it('accepts an explicit story list or provider', async () => {
    const story = { slug: 'x-story', title: { vi: 'a', en: 'b' }, plannerTemplateSlug: 't-1' };
    const repo = makeRepository();
    expect((await createContentCatalog(repo, [], [story]).getLinkedStory('t-1'))?.slug).toBe('x-story');
    expect((await createContentCatalog(repo, [], async () => [story]).getLinkedStory('t-1'))?.slug).toBe('x-story');
  });

  it('a store failure rejects instead of silently dropping the link', async () => {
    const failing = createContentCatalog(makeRepository(), [], async () => {
      throw new Error('store down');
    });
    await expect(failing.getLinkedStory('t-1')).rejects.toThrow('store down');
  });
});

describe('cloning a template from a story with no destination', () => {
  it('is refused with invalid_state', async () => {
    const repo = await repoWithTemplate({ destinationSlug: null });
    const planner = makePlanner({ catalog: createContentCatalog(repo) });
    const { userId } = await makeOwner(planner);
    await expect(
      planner.createTrip(userId, {
        source: 'template',
        templateSlug: 'test-template',
        startDate: null,
        partySize: 2,
        budget: { targetTotalVnd: 5_000_000, currency: 'VND' },
        note: null,
      }),
    ).rejects.toMatchObject({ code: 'invalid_state' });
  });
});
