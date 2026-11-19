import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { destinations } from '@/content/destinations';
import { isVisited } from '@/content/types';
import { landmarkPlaces, seedLandmarkPlaces } from '@/content/travel/seed-places';
import { demoPlaces } from '@/content/travel/seed';
import { pinRadius } from '@/lib/map';

const NEW_SLUGS = [
  'ha-noi',
  'quang-ninh',
  'quang-binh',
  'da-nang',
  'quy-nhon',
  'nha-trang',
  'tp-ho-chi-minh',
  'can-tho',
];

describe('destinations not visited yet (DEST-1)', () => {
  const added = destinations.filter((d) => NEW_SLUGS.includes(d.slug));

  it('adds every approved destination with unique slugs', () => {
    expect(added.map((d) => d.slug).sort()).toEqual([...NEW_SLUGS].sort());
    expect(new Set(destinations.map((d) => d.slug)).size).toBe(destinations.length);
  });

  it('never invents a visit date or count for them', () => {
    for (const d of added) {
      expect(d.firstVisited, d.slug).toBeUndefined();
      expect(d.visits, d.slug).toBeUndefined();
      expect(isVisited(d), d.slug).toBe(false);
    }
  });

  it('keeps visited destinations visited and ahead of the others', () => {
    const visited = destinations.filter(isVisited);
    expect(visited.length).toBe(destinations.length - added.length);
    expect(destinations.slice(0, 4).every(isVisited)).toBe(true);
  });

  it('says plainly that the page is not first-hand, in both languages', () => {
    for (const d of added) {
      expect(d.body.vi.at(-1), d.slug).toContain('chưa đến');
      expect(d.body.en.at(-1), d.slug).toContain('not been');
    }
  });

  it('has existing covers and a small neutral pin radius', () => {
    for (const d of added) {
      expect(existsSync(resolve(process.cwd(), 'public', d.cover.replace(/^\//, ''))), d.slug).toBe(true);
    }
    expect(pinRadius(undefined)).toBe(5);
  });
});

describe('home hero stat (DEST-1)', () => {
  it('counts only visited destinations under the "destinations visited" label', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/sections/hero.tsx'), 'utf8');
    expect(src).toContain('destinations.filter(isVisited).length');
    expect(src).not.toMatch(/value:\s*destinations\.length/);
  });
});

describe('landmark places (DEST-1)', () => {
  it('gives every new destination at least two places and the older four two each', () => {
    const slugs = [...NEW_SLUGS, 'hoi-an', 'sa-pa', 'ha-giang', 'hue'];
    for (const slug of slugs) {
      expect(landmarkPlaces.filter((p) => p.destinationSlug === slug).length, slug).toBeGreaterThanOrEqual(2);
    }
  });

  it('references known destinations, unique slugs, and never invents a rating or note', () => {
    const known = new Set(destinations.map((d) => d.slug));
    for (const p of landmarkPlaces) {
      expect(known.has(p.destinationSlug), p.slug).toBe(true);
      expect(p.rating, p.slug).toBeNull();
      expect(p.personalNote, p.slug).toBeNull();
      expect(p.affiliateLinks, p.slug).toEqual([]);
      for (const src of p.images ?? []) {
        expect(existsSync(resolve(process.cwd(), 'public', src.replace(/^\//, ''))), `${p.slug} ${src}`).toBe(true);
      }
    }
    const all = demoPlaces.map((p) => p.slug);
    expect(new Set(all).size).toBe(all.length);
  });

  it('tops up an existing store create-only and idempotently', async () => {
    const created: string[] = [];
    const store = new Set<string>(['vinh-ha-long']);
    const repo = {
      getPlace: async (slug: string) => {
        if (!store.has(slug)) throw Object.assign(new Error('not found'), { name: 'ContentError', code: 'not_found' });
      },
      createPlace: async (input: { slug: string }) => {
        store.add(input.slug);
        created.push(input.slug);
      },
    };
    const first = await seedLandmarkPlaces(repo as never);
    expect(first.skipped).toEqual(['vinh-ha-long']);
    expect(first.created).toHaveLength(landmarkPlaces.length - 1);
    const second = await seedLandmarkPlaces(repo as never);
    expect(second.created).toEqual([]);
    const outage = { getPlace: async () => { throw new Error('db down'); }, createPlace: async () => undefined };
    await expect(seedLandmarkPlaces(outage as never)).rejects.toThrow('db down');
    const dry = await seedLandmarkPlaces(repo as never, { dryRun: true });
    expect(dry.created).toEqual([]);
  });
});
