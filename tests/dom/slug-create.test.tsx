// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { ContentCreate } from '../../src/components/admin/content/content-create';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={String(href)}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));

const tc = messages.vi.adminContent.create;
const slugBox = () => screen.getByLabelText(tc.fieldSlug) as HTMLInputElement;
const titleVi = () => screen.getAllByLabelText(/Tiếng Việt/i, { exact: false })[0] as HTMLInputElement;

describe('ContentCreate slug UX', () => {
  useDomCleanup();
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
  const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(450); });

  it('fills the slug from the title and stops after a manual edit', async () => {
    stubFetch(() => json(404, { error: { code: 'not_found' } }));
    renderWithIntl(<ContentCreate kind="stories" />);
    type(titleVi(), 'Chợ đêm Đà Lạt');
    expect(slugBox().value).toBe('cho-dem-da-lat');
    type(slugBox(), 'my-own-slug');
    type(titleVi(), 'Chợ đêm Đà Lạt 2');
    expect(slugBox().value).toBe('my-own-slug');
    fireEvent.click(screen.getByRole('button', { name: tc.slugRegenerate }));
    expect(slugBox().value).toBe('cho-dem-da-lat-2');
    type(titleVi(), 'Phố cổ');
    expect(slugBox().value).toBe('pho-co');
    await settle();
  });

  it('shows the VI and EN public paths as text', async () => {
    stubFetch(() => json(404, {}));
    renderWithIntl(<ContentCreate kind="places" />);
    type(slugBox(), 'cho-dem');
    expect(screen.getByText(/\/dia-diem\/cho-dem/)).toBeTruthy();
    expect(screen.getByText(/\/en\/places\/cho-dem/)).toBeTruthy();
    await settle();
  });

  it('reports taken on 200 and free on 404, debounced to one GET', async () => {
    const calls = stubFetch((c) => (c.path.endsWith('/da-lat') ? json(200, { slug: 'da-lat' }) : json(404, {})));
    renderWithIntl(<ContentCreate kind="stories" />);
    type(slugBox(), 'da-l');
    type(slugBox(), 'da-lat');
    await settle();
    expect(calls.map((c) => c.path)).toEqual(['/api/admin/travel/stories/da-lat']);
    expect(await screen.findByText(tc.slugTaken)).toBeTruthy();
    type(slugBox(), 'da-nang');
    await settle();
    expect(await screen.findByText(tc.slugFree)).toBeTruthy();
  });

  it('a network failure says unchecked and does not block submit', async () => {
    const calls = stubFetch((c) => {
      if (c.method === 'POST') return json(201, { slug: 'da-lat' });
      throw new TypeError('offline');
    });
    renderWithIntl(<ContentCreate kind="stories" />);
    type(slugBox(), 'da-lat');
    await settle();
    expect(await screen.findByText(tc.slugUnknown)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tc.submitStory }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
  });

  it('does not call the API for the reserved or an invalid slug, and blocks `new`', async () => {
    const calls = stubFetch(() => json(404, {}));
    renderWithIntl(<ContentCreate kind="stories" />);
    type(slugBox(), 'new');
    await settle();
    expect(screen.getByText(tc.reservedSlug)).toBeTruthy();
    type(slugBox(), 'Bad Slug');
    await settle();
    expect(screen.getByText(tc.slugInvalid)).toBeTruthy();
    expect(calls).toHaveLength(0);
    type(slugBox(), 'new');
    fireEvent.click(screen.getByRole('button', { name: tc.submitStory }));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('still shows the notice when submit returns 409', async () => {
    stubFetch((c) =>
      c.method === 'POST' ? json(409, { error: { code: 'slug_conflict', message: 'x' } }) : json(404, {}),
    );
    renderWithIntl(<ContentCreate kind="places" />);
    type(slugBox(), 'da-lat');
    await settle();
    fireEvent.click(screen.getByRole('button', { name: tc.submitPlace }));
    expect(await screen.findByText(tc.slugConflict)).toBeTruthy();
  });
});
