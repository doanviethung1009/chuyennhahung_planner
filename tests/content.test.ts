import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { destinations } from '../src/content/destinations';
import { stories } from '../src/content/stories';
import { itineraries } from '../src/content/itineraries';
import { videoReviews } from '../src/content/video-reviews';
import { locales } from '../src/i18n/routing';

const publicDir = resolve(import.meta.dirname, '../public');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

describe('content integrity', () => {
  it('has unique, URL-safe slugs in every collection', () => {
    for (const [name, slugs] of [
      ['destinations', destinations.map((d) => d.slug)],
      ['stories', stories.map((s) => s.slug)],
      ['itineraries', itineraries.map((i) => i.slug)],
    ] as const) {
      expect(unique(slugs), `${name} has a duplicate slug`).toBe(true);
      for (const slug of slugs) {
        expect(slug, `${name}: "${slug}" is not URL-safe`).toMatch(slugPattern);
      }
    }
  });

  it('points every cross-reference at a destination that exists', () => {
    const known = new Set(destinations.map((d) => d.slug));

    for (const story of stories) {
      for (const slug of story.destinationSlugs) {
        expect(known, `story "${story.slug}" → unknown "${slug}"`).toContain(slug);
      }
    }
    for (const itinerary of itineraries) {
      for (const slug of itinerary.destinationSlugs) {
        expect(known, `itinerary "${itinerary.slug}" → unknown "${slug}"`).toContain(
          slug,
        );
      }
    }
    for (const video of videoReviews) {
      expect(known, `video "${video.id}" → unknown destination`).toContain(
        video.destinationSlug,
      );
    }
  });

  it('fills every localized field in every locale', () => {
    const check = (label: string, field: Record<string, unknown>) => {
      for (const locale of locales) {
        const value = field[locale];
        expect(value, `${label} is missing ${locale}`).toBeDefined();
        if (typeof value === 'string') {
          expect(value.trim(), `${label}.${locale} is empty`).not.toBe('');
        } else if (Array.isArray(value)) {
          expect(value.length, `${label}.${locale} is an empty list`).toBeGreaterThan(0);
        }
      }
    };

    for (const d of destinations) {
      check(`destination ${d.slug}.name`, d.name);
      check(`destination ${d.slug}.summary`, d.summary);
      check(`destination ${d.slug}.body`, d.body);
      check(`destination ${d.slug}.area`, d.area);
      check(`destination ${d.slug}.bestSeason`, d.bestSeason);
      check(`destination ${d.slug}.tags`, d.tags);
    }
    for (const s of stories) {
      check(`story ${s.slug}.title`, s.title);
      check(`story ${s.slug}.excerpt`, s.excerpt);
      check(`story ${s.slug}.body`, s.body);
    }
    for (const i of itineraries) {
      check(`itinerary ${i.slug}.title`, i.title);
      check(`itinerary ${i.slug}.summary`, i.summary);
      check(`itinerary ${i.slug}.highlights`, i.highlights);
      for (const day of i.dayByDay) {
        check(`itinerary ${i.slug} day ${day.day}.title`, day.title);
        check(`itinerary ${i.slug} day ${day.day}.detail`, day.detail);
      }
    }
  });

  it('references a cover file that exists on disk', () => {
    const covers = [
      ...destinations.map((d) => d.cover),
      ...stories.map((s) => s.cover),
      ...itineraries.map((i) => i.cover),
      ...videoReviews.map((v) => v.cover),
    ];

    for (const cover of covers) {
      expect(
        existsSync(resolve(publicDir, cover.replace(/^\//, ''))),
        `missing cover file: ${cover}`,
      ).toBe(true);
    }
  });

  it('numbers itinerary days consecutively from 1 and matches the day count', () => {
    for (const itinerary of itineraries) {
      const days = itinerary.dayByDay.map((d) => d.day);
      expect(days, `itinerary ${itinerary.slug}`).toEqual(
        Array.from({ length: itinerary.days }, (_, i) => i + 1),
      );
    }
  });

  it('keeps video reviews link-free', () => {
    // Deliberate: we hold no per-video URLs, so a card must not pretend to
    // open one. Visitors reach the clips via the channel buttons instead.
    for (const video of videoReviews) {
      expect(video, `video ${video.id}`).not.toHaveProperty('url');
    }
  });

  it('has unique video ids', () => {
    const ids = videoReviews.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
