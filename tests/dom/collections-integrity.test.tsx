// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionEditor } from '../../src/components/admin/content/collection-editor';
import { ContentList } from '../../src/components/admin/content/content-list';
import { IntegrityReport } from '../../src/components/admin/content/integrity-report';
import { json, messages, renderWithIntl, useDomCleanup } from './helpers';

const t = messages.vi.adminContent;

const text = (vi: string, en: string) => ({ vi, en });
const collection = (over: Record<string, unknown> = {}) => ({
  slug: 'mien-trung',
  title: text('Miền Trung', 'Central'),
  tagline: text('Đi dọc di sản', 'Along heritage'),
  description: { vi: ['Mô tả.'], en: ['Description.'] },
  cover: '/images/covers/da-lat.svg',
  destinationSlugs: ['da-lat'],
  storySlugs: [],
  placeSlugs: [],
  seo: { title: null, description: text('SEO', 'SEO'), ogImage: null, canonicalPath: null, noindex: false, keywords: { vi: [], en: [] } },
  status: 'draft',
  publishedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  ...over,
});

type Call = { path: string; method: string; headers: Record<string, string>; body: unknown };
function stub(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const call: Call = {
        path,
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return respond(call);
    }),
  );
  return calls;
}

describe('CollectionEditor', () => {
  useDomCleanup();

  it('saves with If-Match set to the loaded updatedAt, then shows the saved notice', async () => {
    const calls = stub((c) =>
      c.method === 'PATCH' ? json(200, collection({ updatedAt: '2026-02-02T00:00:00.000Z', cover: '/images/covers/hue.svg' })) : json(200, collection()),
    );
    renderWithIntl(<CollectionEditor slug="mien-trung" />);
    const cover = await screen.findByLabelText(messages.vi.adminContent.collections.fieldCover, { exact: false });
    await userEvent.clear(cover);
    await userEvent.type(cover, '/images/covers/hue.svg');
    await userEvent.click(screen.getByRole('button', { name: t.form.save }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.path).toBe('/api/admin/travel/collections/mien-trung');
    expect(patch.headers['if-match']).toBe('"2026-02-01T00:00:00.000Z"');
    expect(patch.body).toMatchObject({ cover: '/images/covers/hue.svg' });
    expect(patch.body).not.toHaveProperty('slug');
    await waitFor(() => expect(screen.getByText(t.status.saved)).toBeTruthy());
  });

  it('shows the 412 message with a reload button, and reload fetches the latest record', async () => {
    let loads = 0;
    const calls = stub((c) => {
      if (c.method === 'PATCH') return json(412, { error: { code: 'version_conflict', message: 'stale' } });
      loads += 1;
      return json(200, collection(loads > 1 ? { tagline: text('Bản mới', 'Newer') } : {}));
    });
    renderWithIntl(<CollectionEditor slug="mien-trung" />);
    const cover = await screen.findByLabelText(messages.vi.adminContent.collections.fieldCover, { exact: false });
    await userEvent.type(cover, 'x');
    await userEvent.click(screen.getByRole('button', { name: t.form.save }));
    expect(await screen.findByText(t.errors.version_conflict)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t.errors.reload }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2));
    expect(await screen.findByDisplayValue('Bản mới')).toBeTruthy();
  });

  it('changes status through the status endpoint without If-Match', async () => {
    const calls = stub((c) =>
      c.method === 'POST' ? json(200, collection({ status: 'published', publishedAt: '2026-02-03T00:00:00.000Z', updatedAt: '2026-02-03T00:00:00.000Z' })) : json(200, collection()),
    );
    renderWithIntl(<CollectionEditor slug="mien-trung" />);
    await userEvent.click(await screen.findByRole('button', { name: t.actions.publish }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.path).toBe('/api/admin/travel/collections/mien-trung/status');
    expect(post.body).toEqual({ action: 'publish' });
    expect(await screen.findByText(t.status.publish)).toBeTruthy();
  });
});

describe('ContentList for collections', () => {
  useDomCleanup();

  it('lists, searches ignoring diacritics, and has no create or archive button', async () => {
    stub(() => json(200, { collections: [collection(), collection({ slug: 'tay-bac', title: text('Tây Bắc', 'Northwest') })], count: 2 }));
    renderWithIntl(<ContentList kind="collections" />);
    expect(await screen.findByRole('link', { name: 'Miền Trung' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.actions.archive })).toBeNull();
    expect(screen.queryByRole('link', { name: t.stories.newButton })).toBeNull();
    await userEvent.type(screen.getByLabelText(t.list.searchLabel), 'tay bac');
    expect(screen.queryByRole('link', { name: 'Miền Trung' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tây Bắc' })).toBeTruthy();
    await userEvent.clear(screen.getByLabelText(t.list.searchLabel));
    await userEvent.type(screen.getByLabelText(t.list.searchLabel), 'zzzz');
    expect(screen.getByText(t.list.noMatches)).toBeTruthy();
  });

  it('shows the empty state', async () => {
    stub(() => json(200, { collections: [], count: 0 }));
    renderWithIntl(<ContentList kind="collections" />);
    expect(await screen.findByText(t.list.empty)).toBeTruthy();
  });
});

describe('IntegrityReport', () => {
  useDomCleanup();

  it('shows the content report with owner links and never asks for the Planner report for an editor', async () => {
    const calls = stub(() =>
      json(200, { ok: false, issues: [{ entity: 'story', id: 'hue-3n2d', issue: 'unknown place "x"' }, { entity: 'template', id: 'tpl', issue: 'days are not numbered 1..n' }] }),
    );
    renderWithIntl(<IntegrityReport showPlanner={false} />);
    const link = await screen.findByRole('link', { name: 'hue-3n2d' });
    expect(link.getAttribute('href')).toContain('hue-3n2d');
    expect(screen.queryByRole('link', { name: 'tpl' })).toBeNull();
    expect(screen.getByText('tpl')).toBeTruthy();
    expect(calls.map((c) => c.path)).toEqual(['/api/admin/travel/integrity']);
    expect(screen.queryByText(t.integrity.plannerTitle)).toBeNull();
  });

  it('asks for the Planner report for an admin and renders its ids as plain text', async () => {
    const calls = stub((c) =>
      c.path.includes('planner')
        ? json(200, { ok: false, issues: [{ entity: 'trip', id: 'trip_9', issue: 'day numbering gap' }] })
        : json(200, { ok: true, issues: [] }),
    );
    renderWithIntl(<IntegrityReport showPlanner />);
    expect(await screen.findByText('trip_9')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'trip_9' })).toBeNull();
    expect(screen.getByText(t.integrity.clean)).toBeTruthy();
    expect(calls.map((c) => c.path).sort()).toEqual(['/api/admin/planner/integrity', '/api/admin/travel/integrity']);
  });

  it('shows an error with a retry instead of an empty report', async () => {
    let fail = true;
    stub(() => (fail ? json(500, { error: { code: 'internal' } }) : json(200, { ok: true, issues: [] })));
    renderWithIntl(<IntegrityReport showPlanner={false} />);
    expect(await screen.findByText(t.errors.generic)).toBeTruthy();
    expect(screen.queryByText(t.integrity.clean)).toBeNull();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: t.integrity.retry }));
    expect(await screen.findByText(t.integrity.clean)).toBeTruthy();
  });
});
