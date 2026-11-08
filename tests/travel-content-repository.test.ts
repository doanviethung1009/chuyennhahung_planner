import { beforeEach, describe, expect, it } from 'vitest';
import type { TravelContentRepository } from '../src/server/content/repository';
import {
  makeRepository,
  placeFixture,
  reviewFixture,
  storyFixture,
  templateFixture,
} from './travel-content-helpers';

async function expectRejection(
  promise: Promise<unknown>,
  code: string,
): Promise<{ code: string; message: string; issues: { path: string; message: string }[] }> {
  try {
    await promise;
  } catch (error) {
    const typed = error as {
      code: string;
      message: string;
      issues: { path: string; message: string }[];
    };
    expect(typed.code, `expected ${code}, got ${typed.code}: ${typed.message}`).toBe(code);
    return typed;
  }
  throw new Error(`expected the call to reject with "${code}" but it resolved`);
}

let repo: TravelContentRepository;

beforeEach(() => {
  repo = makeRepository();
});

describe('places CRUD', () => {
  it('creates, reads, updates and deletes a place', async () => {
    const created = await repo.createPlace(placeFixture({ slug: 'ho-tuyen-lam' }));
    expect(created.slug).toBe('ho-tuyen-lam');
    expect(created.createdAt).toBe('2026-03-01T08:00:00.000Z');

    expect((await repo.getPlace('ho-tuyen-lam')).name.vi).toBe('Địa điểm thử');

    const updated = await repo.updatePlace('ho-tuyen-lam', { estimatedCostVnd: 80_000 });
    expect(updated.estimatedCostVnd).toBe(80_000);
    // Untouched fields survive a PATCH.
    expect(updated.category).toBe('cafe');

    await repo.deletePlace('ho-tuyen-lam');
    await expectRejection(repo.getPlace('ho-tuyen-lam'), 'not_found');
  });

  it('refuses a duplicate slug', async () => {
    await repo.createPlace(placeFixture());
    await expectRejection(repo.createPlace(placeFixture()), 'slug_conflict');
  });

  it('refuses a place pointing at a destination that does not exist', async () => {
    const error = await expectRejection(
      repo.createPlace(placeFixture({ destinationSlug: 'atlantis' })),
      'invalid_reference',
    );
    expect(error.issues[0]?.path).toBe('destinationSlug');
  });

  it('accepts every real destination slug', async () => {
    for (const slug of ['ha-giang', 'sa-pa', 'ninh-binh', 'hue', 'hoi-an', 'da-lat', 'phu-quoc', 'moc-chau']) {
      await repo.createPlace(
        placeFixture({ slug: `place-${slug}`, destinationSlug: slug }),
      );
    }
    expect(await repo.listPlaces({ limit: 100 })).toHaveLength(8);
  });

  it('filters by destination and category', async () => {
    await repo.createPlace(placeFixture({ slug: 'a-cafe', category: 'cafe' }));
    await repo.createPlace(placeFixture({ slug: 'b-market', category: 'market' }));
    await repo.createPlace(
      placeFixture({ slug: 'c-sapa', destinationSlug: 'sa-pa', category: 'cafe' }),
    );

    expect(await repo.listPlaces({ destinationSlug: 'da-lat' })).toHaveLength(2);
    expect(await repo.listPlaces({ category: 'cafe' })).toHaveLength(2);
    expect(
      await repo.listPlaces({ destinationSlug: 'sa-pa', category: 'cafe' }),
    ).toHaveLength(1);
  });

  it('paginates', async () => {
    for (let i = 0; i < 5; i += 1) {
      await repo.createPlace(placeFixture({ slug: `place-${i}` }));
    }
    const page = await repo.listPlaces({ limit: 2, offset: 2 });
    expect(page.map((p) => p.slug)).toEqual(['place-2', 'place-3']);
  });

  it('refuses to delete a place a story still references, and names the referrer', async () => {
    await repo.createPlace(placeFixture({ slug: 'ho-tuyen-lam' }));
    await repo.createStory(storyFixture({ placeSlugs: ['ho-tuyen-lam'] }));

    const error = await expectRejection(repo.deletePlace('ho-tuyen-lam'), 'invalid_state');
    expect(error.message).toContain('story:test-story');
  });
});

describe('stories CRUD and publishing', () => {
  it('creates a story as a draft, never published straight away', async () => {
    const story = await repo.createStory(storyFixture());
    expect(story.status).toBe('draft');
    expect(story.publishedAt).toBeNull();
  });

  it('recomputes the cost total from the breakdown instead of trusting input', async () => {
    const story = await repo.createStory(
      storyFixture({
        actualCost: {
          partySize: 2,
          currency: 'VND',
          breakdown: [
            { category: 'stay', label: { vi: 'Phòng', en: 'Room' }, amountVnd: 1_300_000 },
            { category: 'food', label: { vi: 'Ăn', en: 'Food' }, amountVnd: 1_080_000 },
          ],
          note: null,
        },
      }),
    );
    expect(story.actualCostTotalVnd).toBe(2_380_000);
  });

  it('reports a null cost total when no cost was recorded', async () => {
    expect((await repo.createStory(storyFixture())).actualCostTotalVnd).toBeNull();
  });

  it('refuses a story referencing a missing place, review or itinerary, all at once', async () => {
    const error = await expectRejection(
      repo.createStory(
        storyFixture({
          placeSlugs: ['ghost-place'],
          reviewIds: ['ghost-review'],
          itinerarySlugs: ['ghost-itinerary'],
          destinationSlug: 'ghost-destination',
        }),
      ),
      'invalid_reference',
    );
    // Every problem is reported in one response, not one per round trip.
    expect(error.issues.map((i) => i.path)).toEqual([
      'destinationSlug',
      'placeSlugs[0]',
      'itinerarySlugs[0]',
      'reviewIds[0]',
    ]);
  });

  it('accepts the real itinerary slug as a related tour service', async () => {
    const story = await repo.createStory(
      storyFixture({ itinerarySlugs: ['da-lat-3-ngay-nghi-that'] }),
    );
    expect(story.itinerarySlugs).toEqual(['da-lat-3-ngay-nghi-that']);
  });

  it('refuses an embedded place block that is missing from placeSlugs', async () => {
    await repo.createPlace(placeFixture({ slug: 'ho-tuyen-lam' }));
    const error = await expectRejection(
      repo.createStory(
        storyFixture({
          placeSlugs: [],
          content: [{ type: 'place', placeSlug: 'ho-tuyen-lam', note: null }],
        }),
      ),
      'invalid_reference',
    );
    expect(error.issues[0]?.message).toContain('missing from placeSlugs');
  });

  it('publishes, unpublishes and archives', async () => {
    await repo.createStory(storyFixture());

    const published = await repo.setStoryStatus('test-story', { action: 'publish' });
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBe('2026-03-01T08:00:00.000Z');

    const unpublished = await repo.setStoryStatus('test-story', { action: 'unpublish' });
    expect(unpublished.status).toBe('draft');
    // The original publish date survives, so re-publishing does not re-date the trip.
    expect(unpublished.publishedAt).toBe('2026-03-01T08:00:00.000Z');

    expect((await repo.setStoryStatus('test-story', { action: 'archive' })).status).toBe(
      'archived',
    );
  });

  it('honours a backdated publish date', async () => {
    await repo.createStory(storyFixture());
    const published = await repo.setStoryStatus('test-story', {
      action: 'publish',
      publishedAt: '2026-02-20T00:00:00.000Z',
    });
    expect(published.publishedAt).toBe('2026-02-20T00:00:00.000Z');
  });

  it('refuses to publish a story whose linked review is still a draft', async () => {
    await repo.createReview(reviewFixture());
    await repo.createStory(storyFixture({ reviewIds: ['test-review'] }));

    const error = await expectRejection(
      repo.setStoryStatus('test-story', { action: 'publish' }),
      'invalid_state',
    );
    expect(error.message).toContain('test-review');

    await repo.setReviewStatus('test-review', { action: 'publish' });
    expect((await repo.setStoryStatus('test-story', { action: 'publish' })).status).toBe(
      'published',
    );
  });

  it('hides a draft story from the public read path', async () => {
    await repo.createStory(storyFixture());
    await expectRejection(repo.getPublishedStory('test-story'), 'not_found');

    await repo.setStoryStatus('test-story', { action: 'publish' });
    expect((await repo.getPublishedStory('test-story')).slug).toBe('test-story');
  });

  it('refuses to delete a published story so a live URL cannot 404', async () => {
    await repo.createStory(storyFixture());
    await repo.setStoryStatus('test-story', { action: 'publish' });

    await expectRejection(repo.deleteStory('test-story'), 'invalid_state');

    await repo.setStoryStatus('test-story', { action: 'unpublish' });
    await expect(repo.deleteStory('test-story')).resolves.toBeUndefined();
  });

  it('sorts newest trip first', async () => {
    await repo.createStory(
      storyFixture({ slug: 'older', travelDates: { start: '2025-01-01', end: '2025-01-03' } }),
    );
    await repo.createStory(
      storyFixture({ slug: 'newer', travelDates: { start: '2026-02-13', end: '2026-02-15' } }),
    );
    expect((await repo.listStories()).map((s) => s.slug)).toEqual(['newer', 'older']);
  });
});

describe('adding places to a story', () => {
  beforeEach(async () => {
    await repo.createPlace(placeFixture({ slug: 'ho-tuyen-lam' }));
    await repo.createPlace(placeFixture({ slug: 'doi-che-cau-dat' }));
    await repo.createStory(storyFixture());
  });

  it('adds places and is idempotent', async () => {
    const once = await repo.patchStoryPlaces('test-story', {
      add: ['ho-tuyen-lam'],
      remove: [],
    });
    expect(once.placeSlugs).toEqual(['ho-tuyen-lam']);

    const twice = await repo.patchStoryPlaces('test-story', {
      add: ['ho-tuyen-lam', 'doi-che-cau-dat'],
      remove: [],
    });
    expect(twice.placeSlugs).toEqual(['ho-tuyen-lam', 'doi-che-cau-dat']);
  });

  it('removes a place that is only linked, not embedded', async () => {
    await repo.patchStoryPlaces('test-story', { add: ['ho-tuyen-lam'], remove: [] });
    const after = await repo.patchStoryPlaces('test-story', {
      add: [],
      remove: ['ho-tuyen-lam'],
    });
    expect(after.placeSlugs).toEqual([]);
  });

  it('refuses to add a place that does not exist', async () => {
    await expectRejection(
      repo.patchStoryPlaces('test-story', { add: ['ghost'], remove: [] }),
      'invalid_reference',
    );
  });

  it('refuses to unlink a place still embedded in the body', async () => {
    await repo.updateStory('test-story', {
      placeSlugs: ['ho-tuyen-lam'],
      content: [{ type: 'place', placeSlug: 'ho-tuyen-lam', note: null }],
    });
    const error = await expectRejection(
      repo.patchStoryPlaces('test-story', { add: [], remove: ['ho-tuyen-lam'] }),
      'invalid_state',
    );
    expect(error.message).toContain('still embedded');
  });
});

describe('reviews', () => {
  it('validates the subject against the right collection', async () => {
    await repo.createPlace(placeFixture({ slug: 'ho-tuyen-lam' }));

    await expect(
      repo.createReview(reviewFixture({ id: 'r-place', subject: { kind: 'place', ref: 'ho-tuyen-lam' } })),
    ).resolves.toBeTruthy();
    await expect(
      repo.createReview(
        reviewFixture({ id: 'r-itin', subject: { kind: 'itinerary', ref: 'da-lat-3-ngay-nghi-that' } }),
      ),
    ).resolves.toBeTruthy();

    // A destination slug is not a valid place reference.
    await expectRejection(
      repo.createReview(reviewFixture({ id: 'r-bad', subject: { kind: 'place', ref: 'da-lat' } })),
      'invalid_reference',
    );
  });

  it('reports a scalar reference path without a bogus array index', async () => {
    const error = await expectRejection(
      repo.createReview(reviewFixture({ subject: { kind: 'place', ref: 'ghost' } })),
      'invalid_reference',
    );
    expect(error.issues[0]?.path).toBe('subject.ref');
  });

  it('refuses to unpublish a review a published story links', async () => {
    await repo.createReview(reviewFixture());
    await repo.setReviewStatus('test-review', { action: 'publish' });
    await repo.createStory(storyFixture({ reviewIds: ['test-review'] }));
    await repo.setStoryStatus('test-story', { action: 'publish' });

    const error = await expectRejection(
      repo.setReviewStatus('test-review', { action: 'unpublish' }),
      'invalid_state',
    );
    expect(error.message).toContain('test-story');
  });

  it('refuses to delete a review a story links', async () => {
    await repo.createReview(reviewFixture());
    await repo.createStory(storyFixture({ reviewIds: ['test-review'] }));
    await expectRejection(repo.deleteReview('test-review'), 'invalid_state');
  });
});

describe('destination collections', () => {
  it('refuses to publish a collection holding an unpublished story', async () => {
    await repo.createStory(storyFixture());
    await repo.createCollection({
      slug: 'test-collection',
      title: { vi: 'Bộ sưu tập', en: 'Collection' },
      tagline: { vi: 'Khẩu hiệu', en: 'Tagline' },
      description: { vi: ['Mô tả.'], en: ['Description.'] },
      cover: '/images/covers/da-lat.svg',
      destinationSlugs: ['da-lat'],
      storySlugs: ['test-story'],
      placeSlugs: [],
      seo: {
        title: null,
        description: { vi: 'Mô tả SEO.', en: 'SEO description.' },
        ogImage: null,
        canonicalPath: null,
        noindex: false,
        keywords: { vi: [], en: [] },
      },
    });

    await expectRejection(
      repo.setCollectionStatus('test-collection', { action: 'publish' }),
      'invalid_state',
    );

    await repo.setStoryStatus('test-story', { action: 'publish' });
    expect(
      (await repo.setCollectionStatus('test-collection', { action: 'publish' })).status,
    ).toBe('published');
  });
});

describe('travel templates', () => {
  beforeEach(async () => {
    await repo.createStory(storyFixture());
  });

  it('derives duration, total cost and place rollup rather than taking them on input', async () => {
    const template = await repo.createTemplate(templateFixture());
    expect(template.durationDays).toBe(2);
    expect(template.estimatedTotalVnd).toBe(600_000);
    expect(template.version).toBe(1);
    expect(template.days.map((d) => d.day)).toEqual([1, 2]);
    expect(template.days[0]?.activities.map((a) => a.order)).toEqual([0, 1]);
    expect(template.days[0]?.activities.map((a) => a.id)).toEqual(['act_1', 'act_2']);
  });

  it('rolls up activity places in first-appearance order, without duplicates', async () => {
    await repo.createPlace(placeFixture({ slug: 'ho-tuyen-lam' }));
    await repo.createPlace(placeFixture({ slug: 'doi-che-cau-dat' }));
    const base = templateFixture();
    const [dayOne, dayTwo] = base.days;
    const template = await repo.createTemplate({
      ...base,
      days: [
        {
          ...dayOne!,
          activities: [
            { ...dayOne!.activities[0]!, placeSlug: 'doi-che-cau-dat' },
            { ...dayOne!.activities[1]!, placeSlug: 'ho-tuyen-lam' },
          ],
        },
        {
          ...dayTwo!,
          activities: [{ ...dayTwo!.activities[0]!, placeSlug: 'doi-che-cau-dat' }],
        },
      ],
    });
    expect(template.placeSlugs).toEqual(['doi-che-cau-dat', 'ho-tuyen-lam']);
  });

  it('refuses a template whose source story does not exist', async () => {
    const error = await expectRejection(
      repo.createTemplate(templateFixture({ sourceStorySlug: 'ghost-story' })),
      'invalid_reference',
    );
    expect(error.issues[0]?.path).toBe('sourceStorySlug');
  });

  it('refuses an activity pointing at a place that does not exist', async () => {
    const base = templateFixture();
    const [dayOne] = base.days;
    const error = await expectRejection(
      repo.createTemplate({
        ...base,
        days: [
          {
            ...dayOne!,
            activities: [{ ...dayOne!.activities[0]!, placeSlug: 'ghost-place' }],
          },
        ],
      }),
      'invalid_reference',
    );
    expect(error.issues[0]?.path).toBe('days[0].activities[0].placeSlug');
  });

  it('refuses a public template cut from an unpublished story', async () => {
    await expectRejection(
      repo.createTemplate(templateFixture({ visibility: 'public' })),
      'invalid_state',
    );
  });

  it('hides a private template from the public read path', async () => {
    await repo.createTemplate(templateFixture());
    await expectRejection(repo.getPublicTemplate('test-template'), 'not_found');
  });

  describe('immutable source snapshot', () => {
    it('freezes the source story at creation and survives later edits', async () => {
      await repo.updateStory('test-story', {
        actualCost: {
          partySize: 2,
          currency: 'VND',
          breakdown: [
            { category: 'stay', label: { vi: 'Phòng', en: 'Room' }, amountVnd: 1_000_000 },
          ],
          note: null,
        },
      });
      const template = await repo.createTemplate(templateFixture());
      expect(template.sourceSnapshot.actualCostTotalVnd).toBe(1_000_000);
      expect(template.sourceSnapshot.title.vi).toBe('Chuyện thử');

      // Rewrite the source story entirely.
      await repo.updateStory('test-story', {
        title: { vi: 'Tiêu đề đã đổi', en: 'Changed title' },
        actualCost: null,
        travelDates: { start: '2030-01-01', end: '2030-01-05' },
      });

      const after = await repo.getTemplate('test-template');
      expect(after.sourceSnapshot.title.vi).toBe('Chuyện thử');
      expect(after.sourceSnapshot.actualCostTotalVnd).toBe(1_000_000);
      expect(after.sourceSnapshot.travelDates).toEqual({
        start: '2026-02-13',
        end: '2026-02-15',
      });
    });

    it('survives the source story being deleted', async () => {
      await repo.createTemplate(templateFixture());
      await repo.deleteStory('test-story');

      const template = await repo.getTemplate('test-template');
      expect(template.sourceSnapshot.storySlug).toBe('test-story');
      expect(template.sourceSnapshot.title.vi).toBe('Chuyện thử');

      // The sweep reports the dangling source as information, not corruption.
      const issues = await repo.validateIntegrity();
      expect(issues).toHaveLength(1);
      expect(issues[0]?.issue).toContain('snapshot retained');
    });

    it('cannot be overwritten through a patch', async () => {
      await repo.createTemplate(templateFixture());
      const patched = await repo.updateTemplate('test-template', {
        title: { vi: 'Mẫu mới', en: 'New template' },
        // @ts-expect-error — the schema strips this; the repository ignores it too.
        sourceSnapshot: { storySlug: 'forged' },
      });
      expect(patched.sourceSnapshot.storySlug).toBe('test-story');
    });

    it('refuses to archive a story a public template depends on', async () => {
      await repo.setStoryStatus('test-story', { action: 'publish' });
      await repo.createTemplate(templateFixture({ visibility: 'public' }));

      const error = await expectRejection(
        repo.setStoryStatus('test-story', { action: 'archive' }),
        'invalid_state',
      );
      expect(error.message).toContain('test-template');
    });
  });

  describe('versioning', () => {
    it('increments on every structural mutation', async () => {
      const created = await repo.createTemplate(templateFixture());
      expect(created.version).toBe(1);

      const renamed = await repo.updateTemplate('test-template', {
        title: { vi: 'Đổi tên', en: 'Renamed' },
      });
      expect(renamed.version).toBe(2);

      const ids = renamed.days[0]?.activities.map((a) => a.id) ?? [];
      const reordered = await repo.reorderActivities('test-template', {
        day: 1,
        activityIds: [...ids].reverse(),
      });
      expect(reordered.version).toBe(3);

      const moved = await repo.moveActivity('test-template', {
        activityId: ids[0]!,
        toDay: 2,
        toIndex: 0,
      });
      expect(moved.version).toBe(4);
    });
  });

  describe('reordering activities', () => {
    it('reorders within a day and renumbers order from zero', async () => {
      const template = await repo.createTemplate(templateFixture());
      const ids = template.days[0]!.activities.map((a) => a.id);

      const reordered = await repo.reorderActivities('test-template', {
        day: 1,
        activityIds: [ids[1]!, ids[0]!],
      });

      const day = reordered.days[0]!;
      expect(day.activities.map((a) => a.id)).toEqual([ids[1], ids[0]]);
      expect(day.activities.map((a) => a.order)).toEqual([0, 1]);
      // Reordering changes sequence, never cost.
      expect(reordered.estimatedTotalVnd).toBe(600_000);
    });

    it('refuses a list that is not a permutation of the day', async () => {
      const template = await repo.createTemplate(templateFixture());
      const ids = template.days[0]!.activities.map((a) => a.id);

      // Missing one.
      await expectRejection(
        repo.reorderActivities('test-template', { day: 1, activityIds: [ids[0]!] }),
        'invalid_state',
      );
      // Duplicated.
      await expectRejection(
        repo.reorderActivities('test-template', {
          day: 1,
          activityIds: [ids[0]!, ids[0]!],
        }),
        'invalid_state',
      );
      // An id from another day.
      await expectRejection(
        repo.reorderActivities('test-template', {
          day: 1,
          activityIds: [ids[0]!, template.days[1]!.activities[0]!.id],
        }),
        'invalid_state',
      );
    });

    it('refuses a day that does not exist', async () => {
      const template = await repo.createTemplate(templateFixture());
      await expectRejection(
        repo.reorderActivities('test-template', {
          day: 9,
          activityIds: [template.days[0]!.activities[0]!.id],
        }),
        'not_found',
      );
    });
  });

  describe('moving an activity between days', () => {
    it('moves across days, renumbers both, and keeps the cost total', async () => {
      const template = await repo.createTemplate(templateFixture());
      const moving = template.days[0]!.activities[0]!;

      const moved = await repo.moveActivity('test-template', {
        activityId: moving.id,
        toDay: 2,
        toIndex: 0,
      });

      expect(moved.days[0]!.activities.map((a) => a.id)).toEqual([
        template.days[0]!.activities[1]!.id,
      ]);
      expect(moved.days[0]!.activities.map((a) => a.order)).toEqual([0]);
      expect(moved.days[1]!.activities.map((a) => a.id)).toEqual([
        moving.id,
        template.days[1]!.activities[0]!.id,
      ]);
      expect(moved.days[1]!.activities.map((a) => a.order)).toEqual([0, 1]);
      expect(moved.estimatedTotalVnd).toBe(600_000);
    });

    it('refuses to empty a day', async () => {
      const template = await repo.createTemplate(templateFixture());
      const onlyActivity = template.days[1]!.activities[0]!;
      await expectRejection(
        repo.moveActivity('test-template', {
          activityId: onlyActivity.id,
          toDay: 1,
          toIndex: 0,
        }),
        'invalid_state',
      );
    });

    it('refuses an unknown activity', async () => {
      await repo.createTemplate(templateFixture());
      await expectRejection(
        repo.moveActivity('test-template', {
          activityId: 'act_nope',
          toDay: 1,
          toIndex: 0,
        }),
        'not_found',
      );
    });
  });

  it('refuses to delete a public template', async () => {
    await repo.setStoryStatus('test-story', { action: 'publish' });
    await repo.createTemplate(templateFixture({ visibility: 'public' }));

    await expectRejection(repo.deleteTemplate('test-template'), 'invalid_state');

    await repo.updateTemplate('test-template', { visibility: 'private' });
    await expect(repo.deleteTemplate('test-template')).resolves.toBeUndefined();
  });
});

describe('store isolation', () => {
  it('does not hand out a live reference into the store', async () => {
    await repo.createPlace(placeFixture());
    const first = await repo.getPlace('test-place');
    first.name.vi = 'Đã bị sửa từ ngoài';

    expect((await repo.getPlace('test-place')).name.vi).toBe('Địa điểm thử');
  });
});

describe('concurrent mutations', () => {
  it('does not lose a write when mutations overlap', async () => {
    const writes = Array.from({ length: 12 }, (_, i) =>
      repo.createPlace(placeFixture({ slug: `concurrent-${i}` })),
    );
    await Promise.all(writes);

    expect(await repo.listPlaces({ limit: 100 })).toHaveLength(12);
  });
});
