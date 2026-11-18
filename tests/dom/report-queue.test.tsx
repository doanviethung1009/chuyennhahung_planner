// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportQueue } from '../../src/components/admin/community/report-queue';
import { ModerationWorkspace, WorkspaceNav } from '../../src/components/admin/community/workspace';
import type { ReportListItem } from '../../src/server/planner/schemas';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

const t = messages.vi.adminReports;

const item = (over: Partial<ReportListItem> = {}): ReportListItem => ({
  id: 'rep-1',
  targetKind: 'review',
  targetId: 'rv-1',
  targetLabel: 'Hồ rất đẹp',
  targetLive: true,
  reason: 'spam',
  note: null,
  status: 'open',
  signedIn: false,
  createdAt: '2026-03-01T10:00:00.000Z',
  handledAt: null,
  handledBy: null,
  handlerReason: null,
  ...over,
});

const list = (items: ReportListItem[]) => json(200, { items });

describe('ReportQueue', () => {
  useDomCleanup();

  it('loads the open list first and shows kind, reason and whether the reporter was signed in', async () => {
    const calls = stubFetch(() => list([item({ signedIn: true })]));
    renderWithIntl(<ReportQueue />);
    expect(await screen.findByText('Hồ rất đẹp')).toBeTruthy();
    expect(calls[0]).toMatchObject({ path: '/api/admin/community/reports?status=open', method: 'GET' });
    expect(screen.getByText(new RegExp(`${t.kinds.review} · ${t.reasons.spam} · ${t.signedIn}`))).toBeTruthy();
  });

  it('shows the empty state for an empty list', async () => {
    stubFetch(() => list([]));
    renderWithIntl(<ReportQueue />);
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it('renders a reader-written note as text, never as markup', async () => {
    stubFetch(() => list([item({ note: '<img src=x onerror=alert(1)>' })]));
    const { container } = renderWithIntl(<ReportQueue />);
    expect(await screen.findByText(/onerror=alert/)).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('marks a removed target as gone and shows the removed label when it has none', async () => {
    stubFetch(() => list([item({ targetLabel: null, targetLive: false })]));
    renderWithIntl(<ReportQueue />);
    expect(await screen.findByText(t.removedLabel)).toBeTruthy();
    expect(screen.getByText(t.gone)).toBeTruthy();
  });

  it('keeps both resolve buttons disabled until the decision note has 3 characters (trimmed)', async () => {
    stubFetch(() => list([item()]));
    renderWithIntl(<ReportQueue />);
    const dismiss = (await screen.findByRole('button', { name: t.dismiss })) as HTMLButtonElement;
    const action = screen.getByRole('button', { name: t.action }) as HTMLButtonElement;
    const reason = screen.getByLabelText(t.reasonLabel);
    expect(dismiss.disabled && action.disabled).toBe(true);
    await userEvent.type(reason, ' ab ');
    expect(dismiss.disabled && action.disabled).toBe(true);
    await userEvent.type(reason, 'c');
    expect(dismiss.disabled || action.disabled).toBe(false);
  });

  it('resolves with the outcome and the trimmed reason, announces it, then reloads the list', async () => {
    let resolved = false;
    const calls = stubFetch((call) => {
      if (call.method === 'POST') {
        resolved = true;
        return json(200, { ok: true });
      }
      return list(resolved ? [] : [item()]);
    });
    renderWithIntl(<ReportQueue />);
    await userEvent.type(await screen.findByLabelText(t.reasonLabel), '  Đã gỡ đánh giá  ');
    await userEvent.click(screen.getByRole('button', { name: t.action }));
    await waitFor(() => expect(screen.getByText(t.empty)).toBeTruthy());
    expect(calls.filter((c) => c.method === 'POST')).toEqual([
      {
        path: '/api/admin/community/reports/rep-1/resolve',
        method: 'POST',
        body: { outcome: 'actioned', reason: 'Đã gỡ đánh giá' },
      },
    ]);
    expect(screen.getByRole('status').textContent).toBe(t.done);
  });

  it('dismisses with the dismissed outcome', async () => {
    const calls = stubFetch(() => list([item()]));
    renderWithIntl(<ReportQueue />);
    await userEvent.type(await screen.findByLabelText(t.reasonLabel), 'không vi phạm');
    await userEvent.click(screen.getByRole('button', { name: t.dismiss }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ outcome: 'dismissed', reason: 'không vi phạm' });
  });

  it('shows no decision form on a handled report, only who handled it and why', async () => {
    stubFetch(() =>
      list([item({ status: 'dismissed', handledBy: 'mod-an', handledAt: '2026-03-02T08:00:00.000Z', handlerReason: 'không vi phạm' })]),
    );
    renderWithIntl(<ReportQueue />);
    expect(await screen.findByText(/mod-an/)).toBeTruthy();
    expect(screen.queryByLabelText(t.reasonLabel)).toBeNull();
    expect(screen.queryByRole('button', { name: t.dismiss })).toBeNull();
    expect(screen.getByText(/không vi phạm/)).toBeTruthy();
  });

  it('shows the error notice and keeps the form when the resolve call fails', async () => {
    stubFetch((call) => (call.method === 'POST' ? json(500, { error: { code: 'internal' } }) : list([item()])));
    renderWithIntl(<ReportQueue />);
    await userEvent.type(await screen.findByLabelText(t.reasonLabel), 'abc');
    await userEvent.click(screen.getByRole('button', { name: t.action }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(messages.vi.adminContent.errors.generic));
    expect(screen.getByLabelText(t.reasonLabel)).toBeTruthy();
  });

  it('refetches with the chosen status when the filter changes', async () => {
    const calls = stubFetch(() => list([]));
    renderWithIntl(<ReportQueue />);
    await screen.findByText(t.empty);
    await userEvent.selectOptions(screen.getByLabelText(t.filter), 'dismissed');
    await waitFor(() => expect(calls.at(-1)!.path).toBe('/api/admin/community/reports?status=dismissed'));
  });

  it('reports a count to the workspace nav for the open list only, not for an archive filter', async () => {
    stubFetch(() => list([item(), item({ id: 'rep-2' })]));
    renderWithIntl(
      <ModerationWorkspace>
        <WorkspaceNav canRestrict={false} />
        <ReportQueue />
      </ModerationWorkspace>,
    );
    await screen.findAllByText('Hồ rất đẹp');
    const nav = screen.getByRole('navigation');
    const link = () => within(nav).getByRole('link', { name: new RegExp(messages.vi.adminCommunity.workspace.nav.reports) });
    await waitFor(() => expect(link().textContent).toMatch(/2$/));
    await userEvent.selectOptions(screen.getByLabelText(t.filter), 'actioned');
    await waitFor(() => expect(/\d$/.test(link().textContent ?? '')).toBe(false));
  });
});
