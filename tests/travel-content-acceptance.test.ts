import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { destinations } from '../src/content/destinations';
import { stories as staticStories } from '../src/content/stories';
import { itineraries } from '../src/content/itineraries';
import {
  daLatRomanticStory,
  daLatRomanticTemplate,
  demoPlaces,
  seedTravelContent,
} from '../src/content/travel/seed';
import type { TravelContentRepository } from '../src/server/content/repository';
import { locales } from '../src/i18n/routing';
import { makeRepository } from './travel-content-helpers';

/**
 * The brief's acceptance test:
 *
 *   "Create a Da Lat 3-day romantic travel story with related places and a
 *    reusable itinerary template."
 *
 * The seed performs it through the public repository API, so this file asserts
 * the outcome rather than re-building it.
 */
const publicDir = resolve(import.meta.dirname, '../public');

let repo: TravelContentRepository;

beforeAll(async () => {
  repo = makeRepository();
  await seedTravelContent(repo);
});

describe('acceptance: a Đà Lạt 3-day romantic story', () => {
  it('is published, Đà Lạt, romantic, and spans three days', async () => {
    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');

    expect(story.status).toBe('published');
    expect(story.destinationSlug).toBe('da-lat');
    expect(story.travelStyle).toBe('romantic');
    expect(story.travelDates).toEqual({ start: '2026-02-13', end: '2026-02-15' });

    const start = Date.parse(`${story.travelDates.start}T00:00:00Z`);
    const end = Date.parse(`${story.travelDates.end}T00:00:00Z`);
    const inclusiveDays = (end - start) / 86_400_000 + 1;
    expect(inclusiveDays).toBe(3);
  });

  it('points at a destination that already exists — no duplicate entity', () => {
    expect(destinations.map((d) => d.slug)).toContain('da-lat');
  });

  it('records the real trip cost as integer đồng that matches its breakdown', async () => {
    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');

    expect(story.actualCost).not.toBeNull();
    expect(story.actualCost?.partySize).toBe(2);
    expect(story.actualCostTotalVnd).toBe(4_380_000);

    const summed = story.actualCost?.breakdown.reduce((n, l) => n + l.amountVnd, 0);
    expect(summed).toBe(story.actualCostTotalVnd);

    for (const line of story.actualCost?.breakdown ?? []) {
      expect(Number.isInteger(line.amountVnd), `${line.category} is not an integer`).toBe(
        true,
      );
    }
  });

  it('links six related places, all of which exist and are in Đà Lạt', async () => {
    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');
    expect(story.placeSlugs).toHaveLength(6);

    for (const slug of story.placeSlugs) {
      const place = await repo.getPlace(slug);
      expect(place.destinationSlug).toBe('da-lat');
      expect(place.coords.lat).toBeGreaterThan(8);
      expect(place.coords.lat).toBeLessThan(24);
      expect(place.coords.lng).toBeGreaterThan(102);
      expect(place.coords.lng).toBeLessThan(110);
    }
  });

  it('links two published reviews', async () => {
    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');
    expect(story.reviewIds).toHaveLength(2);

    for (const id of story.reviewIds) {
      expect((await repo.getReview(id)).status).toBe('published');
    }
  });

  it('links the existing Đà Lạt itinerary as a related tour service', async () => {
    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');
    expect(story.itinerarySlugs).toEqual(['da-lat-3-ngay-nghi-that']);
    // Reused, not re-created — the tour routes stay intact (CLAUDE.md rule 2).
    expect(itineraries.map((i) => i.slug)).toContain('da-lat-3-ngay-nghi-that');
  });

  it('carries SEO metadata in both locales', async () => {
    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');
    for (const locale of locales) {
      expect(story.seo.description[locale].trim()).not.toBe('');
      expect(story.seo.title?.[locale].trim()).not.toBe('');
    }
    expect(story.seo.noindex).toBe(false);
    expect(story.seo.canonicalPath).toBe('/chuyen-di-choi/ba-ngay-lang-man-o-da-lat');
  });

  it('embeds every linked place in the body and declares it', async () => {
    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');
    const embedded = story.content
      .filter((block) => block.type === 'place')
      .map((block) => (block.type === 'place' ? block.placeSlug : ''));

    expect(new Set(embedded).size).toBe(6);
    for (const slug of embedded) {
      expect(story.placeSlugs).toContain(slug);
    }
  });
});

describe('acceptance: a reusable itinerary template cut from that trip', () => {
  it('is public, romantic, three days, and sourced from the story', async () => {
    const template = await repo.getPublicTemplate('da-lat-3-ngay-lang-man');

    expect(template.visibility).toBe('public');
    expect(template.travelStyle).toBe('romantic');
    expect(template.pace).toBe('relaxed');
    expect(template.durationDays).toBe(3);
    expect(template.days).toHaveLength(3);
    expect(template.sourceStorySlug).toBe('ba-ngay-lang-man-o-da-lat');
    expect(template.version).toBe(1);
  });

  it('numbers days 1..3 with ordered activities and no gaps', async () => {
    const template = await repo.getPublicTemplate('da-lat-3-ngay-lang-man');

    expect(template.days.map((d) => d.day)).toEqual([1, 2, 3]);
    for (const day of template.days) {
      expect(day.activities.length).toBeGreaterThan(0);
      expect(day.activities.map((a) => a.order)).toEqual(
        day.activities.map((_, index) => index),
      );
      for (const activity of day.activities) {
        expect(activity.id).toBeTruthy();
        expect(Number.isInteger(activity.estimatedCostVnd)).toBe(true);
      }
    }
  });

  it('totals the activity costs in integer đồng', async () => {
    const template = await repo.getPublicTemplate('da-lat-3-ngay-lang-man');

    const summed = template.days.reduce(
      (total, day) =>
        total + day.activities.reduce((sum, a) => sum + a.estimatedCostVnd, 0),
      0,
    );
    expect(template.estimatedTotalVnd).toBe(summed);
    expect(template.estimatedTotalVnd).toBe(750_000);
  });

  it('rolls up the six related places from its activities', async () => {
    const template = await repo.getPublicTemplate('da-lat-3-ngay-lang-man');
    expect(template.placeSlugs).toHaveLength(6);
    for (const slug of template.placeSlugs) {
      await expect(repo.getPlace(slug)).resolves.toBeTruthy();
    }
  });

  it('holds an immutable snapshot of the source trip', async () => {
    const template = await repo.getPublicTemplate('da-lat-3-ngay-lang-man');

    expect(template.sourceSnapshot.storySlug).toBe('ba-ngay-lang-man-o-da-lat');
    expect(template.sourceSnapshot.destinationSlug).toBe('da-lat');
    expect(template.sourceSnapshot.travelDates).toEqual({
      start: '2026-02-13',
      end: '2026-02-15',
    });
    expect(template.sourceSnapshot.actualCostTotalVnd).toBe(4_380_000);
    expect(template.sourceSnapshot.placeSlugs).toHaveLength(6);
  });

  it('reorders day 2 without changing its cost, and bumps the version', async () => {
    const before = await repo.getPublicTemplate('da-lat-3-ngay-lang-man');
    const dayTwo = before.days[1];
    expect(dayTwo).toBeDefined();
    const ids = dayTwo!.activities.map((a) => a.id);

    const after = await repo.reorderActivities('da-lat-3-ngay-lang-man', {
      day: 2,
      activityIds: [...ids].reverse(),
    });

    expect(after.days[1]?.activities.map((a) => a.id)).toEqual([...ids].reverse());
    expect(after.days[1]?.activities.map((a) => a.order)).toEqual(
      ids.map((_, index) => index),
    );
    expect(after.estimatedTotalVnd).toBe(before.estimatedTotalVnd);
    expect(after.version).toBe(before.version + 1);
  });
});

describe('seed integrity', () => {
  it('leaves the store referentially clean', async () => {
    expect(await repo.validateIntegrity()).toEqual([]);
  });

  it('seeds the whole module set', async () => {
    expect(await repo.listPlaces({ limit: 100 })).toHaveLength(demoPlaces.length);
    // The Đà Lạt story plus the typed-seed stories (ADR 0012).
    expect(await repo.listStories({ limit: 100 })).toHaveLength(1 + staticStories.length);
    expect(await repo.listCollections({ limit: 100 })).toHaveLength(1);
    expect(await repo.listReviews({ limit: 100 })).toHaveLength(2);
    expect(await repo.listTemplates({ limit: 100 })).toHaveLength(1);
  });

  it('publishes the destination collection with both destinations reused', async () => {
    const collection = await repo.getPublishedCollection('cuoi-tuan-lang-man-cao-nguyen');
    expect(collection.destinationSlugs).toEqual(['da-lat', 'moc-chau']);
    expect(collection.storySlugs).toEqual(['ba-ngay-lang-man-o-da-lat']);

    const known = new Set(destinations.map((d) => d.slug));
    for (const slug of collection.destinationSlugs) {
      expect(known).toContain(slug);
    }
  });

  it('is idempotent — a second seed does not duplicate anything', async () => {
    await seedTravelContent(repo);
    expect(await repo.listPlaces({ limit: 100 })).toHaveLength(demoPlaces.length);
    // The Đà Lạt story plus the typed-seed stories (ADR 0012).
    expect(await repo.listStories({ limit: 100 })).toHaveLength(1 + staticStories.length);
  });

  it('fills every localized field in both locales', async () => {
    const check = (label: string, field: Record<string, unknown>) => {
      for (const locale of locales) {
        const value = field[locale];
        expect(value, `${label} is missing ${locale}`).toBeDefined();
        if (typeof value === 'string') {
          expect(value.trim(), `${label}.${locale} is empty`).not.toBe('');
        }
      }
    };

    for (const place of await repo.listPlaces({ limit: 100 })) {
      check(`place ${place.slug}.name`, place.name);
      check(`place ${place.slug}.location`, place.location);
      check(`place ${place.slug}.description`, place.description);
    }

    const story = await repo.getPublishedStory('ba-ngay-lang-man-o-da-lat');
    check('story.title', story.title);
    check('story.excerpt', story.excerpt);
    story.content.forEach((block, index) => {
      if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') {
        check(`story.content[${index}].text`, block.text);
      }
      if (block.type === 'image') check(`story.content[${index}].alt`, block.alt);
      if (block.type === 'cost') check(`story.content[${index}].label`, block.label);
    });

    const template = await repo.getPublicTemplate('da-lat-3-ngay-lang-man');
    check('template.title', template.title);
    check('template.summary', template.summary);
    for (const day of template.days) {
      check(`template day ${day.day}.title`, day.title);
      for (const activity of day.activities) {
        check(`template day ${day.day} activity ${activity.id}.title`, activity.title);
      }
    }
  });

  it('references only cover files that exist on disk', () => {
    const images = [
      ...demoPlaces.flatMap((p) => p.images),
      daLatRomanticStory.cover,
      ...daLatRomanticStory.gallery,
      ...daLatRomanticStory.content.flatMap((b) => (b.type === 'image' ? [b.src] : [])),
    ].filter((src) => src.startsWith('/'));

    for (const src of images) {
      expect(existsSync(resolve(publicDir, src.replace(/^\//, ''))), `missing ${src}`).toBe(
        true,
      );
    }
  });

  it('leaves affiliate links empty rather than inventing a partner', () => {
    for (const place of demoPlaces) {
      expect(place.affiliateLinks, `${place.slug}`).toEqual([]);
    }
  });

  it('keeps the template days consistent with the story it came from', () => {
    // Both describe the same three-day trip; the template is the reusable form.
    expect(daLatRomanticTemplate.days).toHaveLength(3);
    expect(daLatRomanticTemplate.sourceStorySlug).toBe(daLatRomanticStory.slug);
    expect(daLatRomanticTemplate.travelStyle).toBe(daLatRomanticStory.travelStyle);
  });
});
