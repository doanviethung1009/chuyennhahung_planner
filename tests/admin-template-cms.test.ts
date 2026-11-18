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
import { filterAndSort } from '../src/components/admin/content/list-utils';
import {
  appendIndex,
  buildPatch,
  canMoveOut,
  daysChanged,
  isSourceStale,
  normalizeIssuePath,
  shiftIds,
  toDayInputs,
  type TemplateDay,
  type TemplateRecord,
} from '../src/components/admin/content/template-utils';
import vi_messages from '../messages/vi.json';
import en_messages from '../messages/en.json';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const L = (vi: string, en = vi) => ({ vi, en });

const act = (id: string, order: number) => ({
  id,
  order,
  title: L(`Việc ${id}`, `Act ${id}`),
  placeSlug: null,
  startTime: '08:00',
  durationMinutes: 60,
  estimatedCostVnd: 100_000,
  note: null,
});
const record = (): TemplateRecord => ({
  slug: 't',
  sourceStorySlug: 's',
  title: L('Mẫu', 'Tpl'),
  summary: L('Tóm tắt', 'Summary'),
  travelStyle: 'romantic',
  pace: 'relaxed',
  groupSize: L('2 người', '2 people'),
  itinerarySlugs: [],
  visibility: 'private',
  days: [
    { day: 1, title: L('Ngày 1'), summary: null, activities: [act('a', 0), act('b', 1)] },
    { day: 2, title: L('Ngày 2'), summary: null, activities: [act('c', 0)] },
  ],
  durationDays: 2,
  placeSlugs: [],
  estimatedTotalVnd: 300_000,
  version: 1,
  sourceSnapshot: {
    storySlug: 's',
    title: L('Chuyện'),
    destinationSlug: null,
    travelDates: { start: '2026-01-01', end: '2026-01-03' },
    actualCostTotalVnd: null,
    placeSlugs: [],
    storyUpdatedAt: '2026-01-10T00:00:00.000Z',
    snapshotTakenAt: '2026-01-10T00:00:00.000Z',
  },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
});

describe('P07-6 routes and navigation', () => {
  it('registers the Vietnamese and English paths', () => {
    expect(pathnames['/admin/content/templates']).toEqual({
      vi: '/quan-tri/noi-dung/lich-trinh-mau',
      en: '/admin/content/templates',
    });
    expect(pathnames['/admin/content/templates/[slug]'].vi).toBe('/quan-tri/noi-dung/lich-trinh-mau/[slug]');
  });

  it('shows the sidebar entry to editors and above, never to a member', () => {
    const hrefs = (role: 'member' | 'editor' | 'admin') =>
      adminSidebarGroups({ role }).flatMap((group) => group.links.map((link) => link.href));
    for (const role of ['editor', 'admin'] as const) expect(hrefs(role)).toContain('/admin/content/templates');
    expect(hrefs('member')).not.toContain('/admin/content/templates');
  });

  it('keeps the query on a sign-in return to the new screens', () => {
    expect(safeReturnTo('/quan-tri/noi-dung/lich-trinh-mau?x=1', '/f')).toBe('/quan-tri/noi-dung/lich-trinh-mau?x=1');
    expect(safeReturnTo('/quan-tri/noi-dung/lich-trinh-mau/da-lat', '/f')).toBe('/quan-tri/noi-dung/lich-trinh-mau/da-lat');
  });
});

describe('role matrix for the two pages (content gate)', () => {
  const as = (value: unknown) => access.read.mockResolvedValue(value);

  it('answers anonymous and member with a 404 fall-through, editor and admin with access', async () => {
    as({ status: 'forbidden' });
    expect(await requireStaff('vi', '/quan-tri/noi-dung/lich-trinh-mau', 'content').catch((e: unknown) => e)).toBe(NOT_FOUND);
    as({ status: 'anonymous' });
    expect(await requireStaff('vi', '/quan-tri/noi-dung/lich-trinh-mau', 'content').catch((e: unknown) => e)).toBe(NOT_FOUND);
    for (const role of ['editor', 'admin', 'super_admin']) {
      as({ status: 'staff', principal: { kind: 'session', role, userId: 'u', handle: 'h' } });
      expect(await requireStaff('vi', '/quan-tri/noi-dung/lich-trinh-mau', 'content')).toMatchObject({ canContent: true });
    }
  });

  it('wires both pages to the content gate and the admin header', () => {
    for (const file of ['templates/page.tsx', 'templates/[slug]/page.tsx']) {
      const source = read(`src/app/(admin)/[locale]/admin/content/${file}`);
      expect(source).toContain("'content'");
      expect(source).toContain('<AdminPageHeader');
    }
  });
});

describe('template helpers', () => {
  it('detects a stale source only when the story is strictly newer', () => {
    const taken = '2026-01-10T00:00:00.000Z';
    expect(isSourceStale(taken, '2026-02-01T00:00:00.000Z')).toBe(true);
    expect(isSourceStale(taken, taken)).toBe(false);
    expect(isSourceStale(taken, '2025-01-01T00:00:00.000Z')).toBe(false);
    expect(isSourceStale(taken, null)).toBe(false);
    expect(isSourceStale(taken, 'garbage')).toBe(false);
  });

  it('builds an empty patch for an untouched draft', () => {
    expect(buildPatch(record(), record())).toEqual({});
  });

  it('sends metadata only, and never days, when only metadata changed', () => {
    const draft = record();
    draft.title = L('Mẫu mới', 'New');
    draft.visibility = 'public';
    expect(buildPatch(record(), draft)).toEqual({ title: L('Mẫu mới', 'New'), visibility: 'public' });
  });

  it('sends days without ids or order when an activity changed', () => {
    const draft = record();
    draft.days[0]!.activities[1]!.durationMinutes = 90;
    const patch = buildPatch(record(), draft) as { days: ReturnType<typeof toDayInputs> };
    expect(Object.keys(patch)).toEqual(['days']);
    expect(patch.days[0]!.activities[1]!.durationMinutes).toBe(90);
    expect(JSON.stringify(patch)).not.toMatch(/"id"|"order"|"day":/);
  });

  it('ignores ids and order when comparing days', () => {
    const a = record().days;
    const b: TemplateDay[] = JSON.parse(JSON.stringify(a));
    b[0]!.activities[0]!.id = 'other';
    b[0]!.activities[0]!.order = 5;
    expect(daysChanged(a, b)).toBe(false);
  });

  it('shifts ids without mutating and refuses out-of-range moves', () => {
    const ids = ['a', 'b', 'c'];
    expect(shiftIds(ids, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(shiftIds(ids, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(shiftIds(ids, 0, -1)).toBeNull();
    expect(shiftIds(ids, 2, 1)).toBeNull();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('appends to a day, capped at 19, and keeps a day non-empty', () => {
    const r = record();
    expect(appendIndex(r.days[0])).toBe(2);
    expect(appendIndex(undefined)).toBe(0);
    expect(canMoveOut(r.days[0]!)).toBe(true);
    expect(canMoveOut(r.days[1]!)).toBe(false);
  });

  it('turns server issue paths into form-kit paths', () => {
    expect(normalizeIssuePath('days[0].activities[2].placeSlug')).toBe('days.0.activities.2.placeSlug');
  });

  it('reuses the shared list search and sort for templates', () => {
    const items = [
      { slug: 'da-lat', updatedAt: '2026-01-01T00:00:00Z', title: L('Đà Lạt lãng mạn', 'Romantic Da Lat') },
      { slug: 'hue', updatedAt: '2026-02-01T00:00:00Z', title: L('Huế', 'Hue') },
    ];
    expect(filterAndSort(items, { query: 'da lat', sort: 'updated', locale: 'vi' }).map((i) => i.slug)).toEqual(['da-lat']);
    expect(filterAndSort(items, { query: '', sort: 'updated', locale: 'vi' }).map((i) => i.slug)).toEqual(['hue', 'da-lat']);
  });
});

describe('template messages', () => {
  it('exist in both languages with the same keys', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object'
        ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
        : [prefix];
    expect(keys(vi_messages.adminContent.templates).sort()).toEqual(keys(en_messages.adminContent.templates).sort());
    expect(keys(vi_messages.adminContent.templates).length).toBeGreaterThan(30);
    expect(vi_messages.adminContent.nav.templates).toBeTruthy();
    expect(en_messages.adminContent.nav.templates).toBeTruthy();
  });
});
