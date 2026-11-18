import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const NOT_FOUND = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));
vi.mock('../src/i18n/navigation', () => ({ redirect: vi.fn() }));
const access = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../src/server/planner/admin-page', () => ({ readStaffPageAccess: access.read }));

import { pathnames } from '../src/i18n/routing';
import { adminSidebarGroups, requireStaff } from '../src/lib/admin-gate';
import { safeReturnTo } from '../src/lib/return-to';
import { filterAndSort, fold, matchesQuery, type ListItem } from '../src/components/admin/content/list-utils';
import { ownerLink } from '../src/components/admin/content/integrity-utils';
import vi_messages from '../messages/vi.json';
import en_messages from '../messages/en.json';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('P07-15 routes', () => {
  it('registers the Vietnamese and English paths', () => {
    expect(pathnames['/admin/content/collections']).toEqual({
      vi: '/quan-tri/noi-dung/bo-suu-tap',
      en: '/admin/content/collections',
    });
    expect(pathnames['/admin/content/collections/[slug]'].vi).toBe('/quan-tri/noi-dung/bo-suu-tap/[slug]');
    expect(pathnames['/admin/content/integrity']).toEqual({
      vi: '/quan-tri/noi-dung/toan-ven',
      en: '/admin/content/integrity',
    });
  });

  it('shows both screens to editors and above, never to a member', () => {
    const hrefs = (role: 'member' | 'editor' | 'admin') =>
      adminSidebarGroups({ role }).flatMap((group) => group.links.map((link) => link.href));
    for (const role of ['editor', 'admin'] as const) {
      expect(hrefs(role)).toEqual(expect.arrayContaining(['/admin/content/collections', '/admin/content/integrity']));
    }
    expect(hrefs('member')).not.toContain('/admin/content/collections');
  });

  it('keeps the query on a sign-in return to the new screens', () => {
    expect(safeReturnTo('/quan-tri/noi-dung/bo-suu-tap?x=1', '/fallback')).toBe('/quan-tri/noi-dung/bo-suu-tap?x=1');
    expect(safeReturnTo('/quan-tri/noi-dung/bo-suu-tap/mien-trung', '/fallback')).toBe('/quan-tri/noi-dung/bo-suu-tap/mien-trung');
    expect(safeReturnTo('/quan-tri/noi-dung/toan-ven', '/fallback')).toBe('/quan-tri/noi-dung/toan-ven');
  });
});

describe('role matrix for the two pages (content gate)', () => {
  const need = 'content';
  const as = (value: unknown) => access.read.mockResolvedValue(value);

  it('answers anonymous with a sign-in redirect and a member with a 404', async () => {
    as({ status: 'forbidden' });
    expect(await requireStaff('vi', '/quan-tri/noi-dung/toan-ven', need).catch((e: unknown) => e)).toBe(NOT_FOUND);
    as({ status: 'anonymous' });
    // `redirect` is mocked and returns, so the gate falls through to the 404.
    expect(await requireStaff('vi', '/quan-tri/noi-dung/bo-suu-tap', need).catch((e: unknown) => e)).toBe(NOT_FOUND);
  });

  it('lets an editor in without the Planner report, and an admin in with it', async () => {
    as({ status: 'staff', principal: { kind: 'session', role: 'editor', userId: 'u1', handle: 'ed' } });
    expect(await requireStaff('vi', '/quan-tri/noi-dung/toan-ven', need)).toMatchObject({ canContent: true, canUsers: false });
    as({ status: 'staff', principal: { kind: 'session', role: 'admin', userId: 'u2', handle: 'ad' } });
    expect(await requireStaff('vi', '/quan-tri/noi-dung/toan-ven', need)).toMatchObject({ canContent: true, canUsers: true });
  });

  it('wires the integrity page to showPlanner = canUsers and both pages to the content gate', () => {
    const integrity = read('src/app/(admin)/[locale]/admin/content/integrity/page.tsx');
    expect(integrity).toContain("'content'");
    expect(integrity).toMatch(/showPlanner=\{canUsers\}/);
    expect(read('src/app/(admin)/[locale]/admin/content/collections/page.tsx')).toContain("'content'");
    expect(read('src/app/(admin)/[locale]/admin/content/collections/[slug]/page.tsx')).toContain("'content'");
  });
});

const item = (slug: string, vi: string, en: string, updatedAt: string): ListItem => ({
  slug,
  updatedAt,
  title: { vi, en },
});

describe('list search and sort helpers', () => {
  const items = [
    item('da-lat', 'Đà Lạt mộng mơ', 'Dreamy Da Lat', '2026-01-02T00:00:00.000Z'),
    item('hue', 'Huế trầm mặc', 'Quiet Hue', '2026-03-01T00:00:00.000Z'),
    item('an-bang', 'Biển An Bàng', 'An Bang beach', '2026-02-01T00:00:00.000Z'),
  ];

  it('folds case and diacritics', () => {
    expect(fold('  Đà Lạt ')).toBe('da lat');
    expect(matchesQuery(items[0]!, 'da lat')).toBe(true);
    expect(matchesQuery(items[0]!, 'DREAMY')).toBe(true);
    expect(matchesQuery(items[0]!, 'hue')).toBe(false);
    expect(matchesQuery(items[0]!, '   ')).toBe(true);
  });

  it('filters across slug and both languages', () => {
    const result = filterAndSort(items, { query: 'beach', sort: 'slug', locale: 'vi' });
    expect(result.map((i) => i.slug)).toEqual(['an-bang']);
    expect(filterAndSort(items, { query: 'zzz', sort: 'slug', locale: 'vi' })).toEqual([]);
  });

  it('sorts by updated (newest first), title and slug without mutating the input', () => {
    const before = items.map((i) => i.slug);
    expect(filterAndSort(items, { query: '', sort: 'updated', locale: 'vi' }).map((i) => i.slug)).toEqual(['hue', 'an-bang', 'da-lat']);
    expect(filterAndSort(items, { query: '', sort: 'slug', locale: 'vi' }).map((i) => i.slug)).toEqual(['an-bang', 'da-lat', 'hue']);
    expect(filterAndSort(items, { query: '', sort: 'title', locale: 'en' }).map((i) => i.slug)).toEqual(['an-bang', 'da-lat', 'hue']);
    expect(items.map((i) => i.slug)).toEqual(before);
  });

  it('falls back to the slug when an item has no title', () => {
    const bare = { slug: 'x-slug', updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(matchesQuery(bare, 'x-slug')).toBe(true);
  });
});

describe('integrity findings link to the owning record', () => {
  it('maps content entities to their editors and leaves the rest as text', () => {
    expect(ownerLink('story', 's1')).toEqual({ pathname: '/admin/content/stories/[slug]', params: { slug: 's1' } });
    expect(ownerLink('place', 'p1')).toEqual({ pathname: '/admin/content/places/[slug]', params: { slug: 'p1' } });
    expect(ownerLink('collection', 'c1')).toEqual({ pathname: '/admin/content/collections/[slug]', params: { slug: 'c1' } });
    expect(ownerLink('review', 'r1')).toBe('/admin/content/reviews');
    expect(ownerLink('template', 't1')).toBeNull();
    expect(ownerLink('trip', 'trip_1')).toBeNull();
    expect(ownerLink('planner user', 'u1')).toBeNull();
  });
});

describe('collections and integrity messages', () => {
  it('exist in both languages with the same keys', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object'
        ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
        : [prefix];
    for (const section of ['collections', 'integrity'] as const) {
      expect(keys(vi_messages.adminContent[section]).sort()).toEqual(keys(en_messages.adminContent[section]).sort());
      expect(keys(vi_messages.adminContent[section]).length).toBeGreaterThan(5);
    }
    expect(vi_messages.adminContent.nav.collections).toBeTruthy();
    expect(en_messages.adminContent.nav.integrity).toBeTruthy();
  });
});
