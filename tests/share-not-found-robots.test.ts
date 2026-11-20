import { describe, expect, it } from 'vitest';

// A token URL's 404 must never carry the layout's `index, follow` (a browser run
// showed both tags side by side). The 404 files state noindex themselves.
describe('share token 404s are never indexable', () => {
  it.each([
    ['shared-map', () => import('../src/app/[locale]/shared-map/[token]/not-found')],
    ['shared', () => import('../src/app/[locale]/shared/[token]/not-found')],
  ])('%s not-found exports robots noindex, nofollow', async (_name, load) => {
    const mod = await load();
    expect(mod.metadata.robots).toEqual({ index: false, follow: false });
    expect(typeof mod.default).toBe('function');
  });
});
