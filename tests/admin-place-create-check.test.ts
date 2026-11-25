import { describe, expect, it } from 'vitest';
import { placeCreateSchema } from '@/server/content/schemas';
import { checkPlaceDraft, problemsFromIssues, reasonOf } from '@/components/admin/content/issue-reason';

const filled = {
  slug: 'ca-phe-moi',
  name: { vi: 'Cà phê mới', en: 'New cafe' },
  destinationSlug: 'da-lat',
  location: { vi: 'Phố cổ', en: 'Old quarter' },
  coords: { lat: 11.94, lng: 108.45 },
  category: 'cafe',
  description: { vi: ['Một đoạn'], en: ['A paragraph'] },
  suggestedMinutes: 60,
  estimatedCostVnd: 50000,
};
const reasons = (draft: unknown) => Object.fromEntries(checkPlaceDraft(draft).map((p) => [p.path, p.reason]));

describe('create-place pre-check (same schema as the POST)', () => {
  it('accepts a complete draft', () => {
    expect(checkPlaceDraft(filled)).toEqual([]);
  });

  it('names every gap of the untouched form at once, with a reason each', () => {
    const empty = {
      ...filled,
      slug: '',
      name: { vi: '', en: '' },
      destinationSlug: '',
      location: { vi: '', en: '' },
      coords: { lat: null, lng: null },
      description: { vi: [], en: [] },
    };
    const found = reasons(empty);
    for (const path of ['slug', 'name.vi', 'name.en', 'destinationSlug', 'location.vi', 'location.en', 'coords.lat', 'coords.lng', 'description.vi', 'description.en']) {
      expect(found[path], path).toEqual({ key: 'required' });
    }
  });

  it('flags only the English half when Vietnamese is filled', () => {
    const found = reasons({ ...filled, name: { vi: 'Cà phê', en: '  ' }, description: { vi: ['x'], en: [] } });
    expect(Object.keys(found).sort()).toEqual(['description.en', 'name.en']);
  });

  it('explains number problems instead of one generic line', () => {
    const found = reasons({ ...filled, suggestedMinutes: 2, estimatedCostVnd: 1.5, coords: { lat: 95, lng: null } });
    expect(found.suggestedMinutes).toEqual({ key: 'min', n: 5 });
    expect(found.estimatedCostVnd).toEqual({ key: 'whole' });
    expect(found['coords.lat']).toEqual({ key: 'max', n: 90 });
    expect(found['coords.lng']).toEqual({ key: 'required' });
  });

  it('a short or reserved slug gets its own reason', () => {
    expect(reasons({ ...filled, slug: '12' }).slug).toEqual({ key: 'minLength', n: 3 });
    expect(reasons({ ...filled, slug: 'new' }).slug).toEqual({ key: 'reserved' });
    expect(reasons({ ...filled, slug: 'Ca Phe' }).slug).toEqual({ key: 'format' });
  });
});

describe('reading a server 422', () => {
  it('maps the repository reference message and keeps the first reason per path', () => {
    expect(reasonOf('destination "123" does not exist')).toEqual({ key: 'reference' });
    const problems = problemsFromIssues([
      { path: 'destinationSlug', message: 'Too small: expected string to have >=3 characters' },
      { path: 'destinationSlug', message: 'must be lowercase words joined by single hyphens' },
    ]);
    expect(problems).toEqual([{ path: 'destinationSlug', reason: { key: 'minLength', n: 3 } }]);
  });

  it('an unknown wording falls back to the generic reason', () => {
    expect(reasonOf('something new')).toEqual({ key: 'invalid' });
  });
});

describe('the client check agrees with placeCreateSchema', () => {
  const variants: Record<string, unknown>[] = [
    {},
    { slug: '' },
    { slug: '12' },
    { slug: 'new' },
    { slug: 'Ca Phe' },
    { slug: 'a'.repeat(97) },
    { destinationSlug: '' },
    { destinationSlug: '123' },
    { destinationSlug: 'Da Lat' },
    { name: { vi: '', en: 'x' } },
    { name: { vi: 'x', en: '   ' } },
    { location: { vi: '', en: '' } },
    { coords: { lat: null, lng: null } },
    { coords: { lat: 91, lng: 0 } },
    { coords: { lat: 0, lng: -181 } },
    { coords: { lat: 0, lng: 180 } },
    { description: { vi: [], en: ['x'] } },
    { description: { vi: ['x'], en: [] } },
    { suggestedMinutes: 4 },
    { suggestedMinutes: 5 },
    { suggestedMinutes: 1441 },
    { suggestedMinutes: 30.5 },
    { suggestedMinutes: null },
    { estimatedCostVnd: -1 },
    { estimatedCostVnd: 0 },
    { estimatedCostVnd: 1.5 },
    { estimatedCostVnd: 1_000_000_000_001 },
    { estimatedCostVnd: null },
  ];
  it.each(variants.map((patch, index) => [index, patch] as const))('variant %i', (_index, patch) => {
    const draft = { ...filled, ...patch };
    const parsed = placeCreateSchema.safeParse(draft);
    const server = parsed.success ? [] : [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    expect(checkPlaceDraft(draft).map((problem) => problem.path).sort()).toEqual(server.sort());
  });
});
