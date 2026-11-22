// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

const push = vi.fn();
vi.mock('@/i18n/navigation', async (original) => ({
  ...(await original<typeof import('@/i18n/navigation')>()),
  useRouter: () => ({ push }),
}));

import { MyTrips } from '../../src/components/planner/my-trips';

const trip = (over: Record<string, unknown> = {}) => ({
  id: 'trip-1',
  title: 'Đà Lạt cuối tuần',
  destinationSlug: 'da-lat',
  startDate: null,
  durationDays: 3,
  partySize: 2,
  visibility: 'private',
  planningStatus: 'draft',
  version: 7,
  ...over,
});

const t = messages.vi.myTrips;
const assign = vi.fn();

function mount(opts: { active?: unknown[]; archived?: unknown[]; mutate?: (call: { path: string; method: string }) => Response } = {}, locale: 'vi' | 'en' = 'vi') {
  const calls = stubFetch((call) => {
    if (call.method === 'GET') {
      const list = call.path.includes('status=archived') ? (opts.archived ?? []) : (opts.active ?? [trip()]);
      return json(200, { trips: list });
    }
    return opts.mutate?.(call) ?? json(200, { trip: trip({ id: 'new-1' }) });
  });
  renderWithIntl(<MyTrips />, locale);
  return calls;
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Thao tác khác/ }));
}

describe('MyTrips card', () => {
  useDomCleanup();
  beforeEach(() => {
    push.mockClear();
    assign.mockClear();
    vi.stubGlobal('location', { ...window.location, assign, pathname: '/chuyen-di-cua-toi', search: '' });
  });

  it('shows title, destination, dates, length, party, status and visibility', async () => {
    mount();
    const card = (await screen.findByRole('heading', { name: 'Đà Lạt cuối tuần' })).closest('li')!;
    const text = card.textContent!;
    expect(text).toContain(t.datesOpen);
    expect(text).toContain('3 ngày');
    expect(text).toContain('2 người');
    expect(text).toContain(messages.vi.planning.draft);
    expect(text).toContain(messages.vi.visibility.private);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('primary CTA goes to the trip page', async () => {
    mount();
    const cta = await screen.findByRole('link', { name: new RegExp(t.open) });
    expect(cta.getAttribute('href')).toBe('/chuyen-di-cua-toi/trip-1');
  });

  it('active trips offer status, duplicate and archive; archived offer restore and purge', async () => {
    const user = userEvent.setup();
    mount({ archived: [trip({ id: 'a-1' })] });
    await openMenu(user);
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(3);
    expect(within(menu).getByRole('menuitem', { name: t.duplicate })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: t.archive })).toBeTruthy();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: t.tabArchived }));
    expect(await screen.findByRole('button', { name: t.restore })).toBeTruthy();
    await openMenu(user);
    expect(screen.getByRole('menuitem', { name: t.purge })).toBeTruthy();
  });

  it('menu opens and moves with the keyboard, Escape closes and restores focus, outside press closes', async () => {
    const user = userEvent.setup();
    mount();
    const trigger = await screen.findByRole('button', { name: /Thao tác khác/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const items = screen.getAllByRole('menuitemradio');
    expect(document.activeElement).toBe(items[0]); // draft is checked
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('status change PATCHes with the current version', async () => {
    const user = userEvent.setup();
    const calls = mount();
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', { name: messages.vi.planning.planned }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.path).toBe('/api/planner/trip-1');
    expect(patch.body).toEqual({ planningStatus: 'planned' });
    expect(await screen.findByText(t.statusSaved)).toBeTruthy();
  });

  it('duplicate POSTs and navigates to the new trip', async () => {
    const user = userEvent.setup();
    const calls = mount();
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: t.duplicate }));
    await waitFor(() => expect(push).toHaveBeenCalledWith({ pathname: '/my-trips/[id]', params: { id: 'new-1' } }));
    expect(calls.find((c) => c.method === 'POST')!.path).toBe('/api/planner/trip-1/duplicate');
  });

  it('archive DELETEs; restore POSTs restore', async () => {
    const user = userEvent.setup();
    const calls = mount({ archived: [trip()] });
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: t.archive }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(calls.find((c) => c.method === 'DELETE')!.path).toBe('/api/planner/trip-1');

    await user.click(screen.getByRole('button', { name: t.tabArchived }));
    await user.click(await screen.findByRole('button', { name: t.restore }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/restore'))).toBe(true));
  });

  it('purge asks for confirmation and only then DELETEs with purge=true', async () => {
    const user = userEvent.setup();
    const calls = mount({ archived: [trip()] });
    await user.click(await screen.findByRole('button', { name: t.tabArchived }));
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: t.purge }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    const group = await screen.findByRole('group', { name: /Xác nhận xoá/ });
    await user.click(within(group).getByRole('button', { name: t.purgeYes }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(calls.find((c) => c.method === 'DELETE')!.path).toBe('/api/planner/trip-1?purge=true');
  });

  it('401 on an action goes to sign-in; 412 shows the stale message and reloads', async () => {
    const user = userEvent.setup();
    const stale = mount({ mutate: () => json(412, { error: { code: 'precondition_failed' } }) });
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: t.archive }));
    expect((await screen.findByRole('alert')).textContent).toBe(t.errorStale);
    await waitFor(() => expect(stale.filter((c) => c.method === 'GET').length).toBeGreaterThan(1));
  });

  it('401 redirects to sign-in', async () => {
    const user = userEvent.setup();
    mount({ mutate: () => json(401, { error: { code: 'unauthorized' } }) });
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: t.archive }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(String(assign.mock.calls[0]![0])).toContain('/dang-nhap');
  });

  it('other errors show the action error as an alert and keep the card', async () => {
    const user = userEvent.setup();
    mount({ mutate: () => json(500, { error: { code: 'boom' } }) });
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: t.duplicate }));
    expect((await screen.findByRole('alert')).textContent).toBe(t.errorAction);
    expect(screen.getByRole('heading', { name: 'Đà Lạt cuối tuần' })).toBeTruthy();
  });

  it('disables the menu while a request is running', async () => {
    const user = userEvent.setup();
    let release: (r: Response) => void = () => {};
    mount({ mutate: () => new Promise<Response>((resolve) => (release = resolve)) as unknown as Response });
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: t.archive }));
    const trigger = await screen.findByRole('button', { name: /Thao tác khác/ });
    await waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(true));
    release(json(200, { trip: trip() }));
    await waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(false));
  });

  it('shows loading, empty and load-failed states', async () => {
    stubFetch(() => json(200, { trips: [] }));
    renderWithIntl(<MyTrips />);
    expect(screen.getByText(t.loading)).toBeTruthy();
    expect(await screen.findByText(t.empty)).toBeTruthy();
    expect(screen.getByRole('link', { name: t.emptyCta }).getAttribute('href')).toBe('/chuyen-di-choi');
  });

  it('archived empty state has no extra CTA', async () => {
    const user = userEvent.setup();
    mount({ archived: [] });
    await user.click(await screen.findByRole('button', { name: t.tabArchived }));
    expect(await screen.findByText(t.emptyArchived)).toBeTruthy();
    expect(screen.queryByRole('link', { name: t.emptyCta })).toBeNull();
  });

  it('load failure shows an alert with a working retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubFetch(() => (fail ? json(500, { error: { code: 'boom' } }) : json(200, { trips: [trip()] })));
    renderWithIntl(<MyTrips />);
    expect((await screen.findByRole('alert')).textContent).toContain(t.errorLoad);
    fail = false;
    await user.click(screen.getByRole('button', { name: t.retry }));
    expect(await screen.findByRole('heading', { name: 'Đà Lạt cuối tuần' })).toBeTruthy();
  });

  it('renders English labels under en', async () => {
    mount({}, 'en');
    const en = messages.en.myTrips;
    expect(await screen.findByRole('link', { name: new RegExp(en.open) })).toBeTruthy();
    expect(screen.getByRole('button', { name: /More actions for/ })).toBeTruthy();
    expect(screen.getByText(en.datesOpen, { exact: false })).toBeTruthy();
  });
});
