import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TravelContentRepository } from '../src/server/content/repository';
import { makeRepository, placeFixture, storyFixture } from './travel-content-helpers';
import { invalidateCatalogueCache } from '../src/server/public-catalogue-cache';
import { isPublishedPlace } from '../src/server/content/schemas';

const holder = vi.hoisted(() => ({ repo: null as unknown }));
vi.mock('../src/server/content/instance', () => ({
  getRepository: () => Promise.resolve(holder.repo),
}));

let repo: TravelContentRepository;

beforeEach(() => {
  invalidateCatalogueCache();
  repo = makeRepository();
  holder.repo = repo;
});

describe('place publish state (ADR 0035)', () => {
  it('createPlace is published by default and a draft when asked', async () => {
    const live = await repo.createPlace(placeFixture({ slug: 'live' }));
    const draft = await repo.createPlace(placeFixture({ slug: 'draft' }), { status: 'draft' });
    expect(live.status).toBe('published');
    expect(live.publishedAt).not.toBeNull();
    expect(draft.status).toBe('draft');
    expect(draft.publishedAt).toBeNull();
  });

  it('treats a stored place without a status as published', () => {
    expect(isPublishedPlace({})).toBe(true);
    expect(isPublishedPlace({ status: 'draft' })).toBe(false);
    expect(isPublishedPlace({ status: 'archived' })).toBe(false);
  });

  it('filters listPlaces by status and hides a draft from getPublishedPlace', async () => {
    await repo.createPlace(placeFixture({ slug: 'live' }));
    await repo.createPlace(placeFixture({ slug: 'draft' }), { status: 'draft' });
    expect((await repo.listPlaces()).map((p) => p.slug)).toEqual(['draft', 'live']);
    expect((await repo.listPlaces({ status: 'published' })).map((p) => p.slug)).toEqual(['live']);
    await expect(repo.getPublishedPlace('draft')).rejects.toMatchObject({ code: 'not_found' });
    expect((await repo.getPlace('draft')).slug).toBe('draft');
  });

  it('keeps a draft out of the public catalogue and the review picker', async () => {
    await repo.createPlace(placeFixture({ slug: 'live' }));
    await repo.createPlace(placeFixture({ slug: 'draft' }), { status: 'draft' });
    const { searchPublicPlaces, getPublicPlace } = await import('../src/server/content/public-places');
    const { getReviewPlaces } = await import('../src/server/community/public');
    expect((await searchPublicPlaces({ page: 1 })).places.map((p) => p.slug)).toEqual(['live']);
    expect(await getPublicPlace('draft')).toBeNull();
    expect((await getReviewPlaces()).map((p) => p.slug)).toEqual(['live']);
  });

  it('publish, unpublish and archive move the status; republishing keeps the date', async () => {
    await repo.createPlace(placeFixture({ slug: 'p' }), { status: 'draft' });
    const first = await repo.setPlaceStatus('p', { action: 'publish' });
    expect(first.status).toBe('published');
    const stamp = first.publishedAt;
    expect(stamp).not.toBeNull();
    expect((await repo.setPlaceStatus('p', { action: 'unpublish' })).status).toBe('draft');
    expect((await repo.setPlaceStatus('p', { action: 'archive' })).status).toBe('archived');
    expect((await repo.setPlaceStatus('p', { action: 'publish' })).publishedAt).toBe(stamp);
    await expect(repo.setPlaceStatus('nope', { action: 'publish' })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('refuses to take a place down while a published story shows it', async () => {
    await repo.createPlace(placeFixture({ slug: 'p' }));
    await repo.createStory(storyFixture({ slug: 's', placeSlugs: ['p'] }));
    await repo.setStoryStatus('s', { action: 'publish' });
    await expect(repo.setPlaceStatus('p', { action: 'unpublish' })).rejects.toMatchObject({ code: 'invalid_state' });
    await expect(repo.setPlaceStatus('p', { action: 'archive' })).rejects.toMatchObject({ code: 'invalid_state' });
    await repo.setStoryStatus('s', { action: 'unpublish' });
    expect((await repo.setPlaceStatus('p', { action: 'unpublish' })).status).toBe('draft');
  });

  it('refuses to publish a story that shows an unpublished place', async () => {
    await repo.createPlace(placeFixture({ slug: 'p' }), { status: 'draft' });
    await repo.createStory(storyFixture({ slug: 's', placeSlugs: ['p'] }));
    await expect(repo.setStoryStatus('s', { action: 'publish' })).rejects.toMatchObject({ code: 'invalid_state' });
    await repo.setPlaceStatus('p', { action: 'publish' });
    expect((await repo.setStoryStatus('s', { action: 'publish' })).status).toBe('published');
  });
});
