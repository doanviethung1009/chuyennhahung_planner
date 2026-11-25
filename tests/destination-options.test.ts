import { describe, expect, it } from 'vitest';
import { destinations } from '../src/content/destinations';
import { destinationOptions } from '../src/lib/destination-options';
import { makeRepository, placeFixture } from './travel-content-helpers';

describe('destinationOptions (place form picker)', () => {
  it('lists every destination once, with names only', () => {
    const options = destinationOptions();
    expect(options.map((o) => o.slug)).toEqual(destinations.map((d) => d.slug));
    for (const option of options) {
      expect(Object.keys(option).sort()).toEqual(['name', 'slug']);
      expect(option.name.vi).not.toBe('');
      expect(option.name.en).not.toBe('');
    }
  });

  it('only offers slugs the repository accepts as a place destination', async () => {
    const repo = makeRepository();
    for (const option of destinationOptions()) {
      await expect(
        repo.createPlace(placeFixture({ slug: `p-${option.slug}`, destinationSlug: option.slug }), { status: 'draft' }),
      ).resolves.toMatchObject({ destinationSlug: option.slug });
    }
    await expect(
      repo.createPlace(placeFixture({ slug: 'p-123', destinationSlug: '123' })),
    ).rejects.toMatchObject({ code: 'invalid_reference' });
  });
});
