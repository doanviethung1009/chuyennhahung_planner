// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportButton } from '../../src/components/reports/report-button';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

const t = messages.vi.communityReports;

describe('ReportButton', () => {
  useDomCleanup();

  it('is a real button that names its target and opens a dialog labelled by its title', async () => {
    stubFetch(() => json(201, { ok: true }));
    renderWithIntl(<ReportButton target={{ kind: 'trip', shareToken: 'tok' }} />);
    const button = screen.getByRole('button', { name: t.buttonTrip });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(false);
    await userEvent.click(button);
    expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(true);
    const dialog = document.querySelector('dialog')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByRole('heading', { name: t.title, hidden: true }).id);
  });

  it('uses the review wording for a review target', () => {
    stubFetch(() => json(201, { ok: true }));
    renderWithIntl(<ReportButton target={{ kind: 'review', id: 'r1' }} />);
    expect(screen.getByRole('button', { name: t.buttonReview })).toBeTruthy();
  });

  it('posts a trip report with the share token, trims the note and sends the empty honeypot', async () => {
    const calls = stubFetch(() => json(201, { ok: true }));
    renderWithIntl(<ReportButton target={{ kind: 'trip', shareToken: 'tok-1' }} />);
    await userEvent.click(screen.getByRole('button', { name: t.buttonTrip }));
    await userEvent.selectOptions(screen.getByLabelText(t.reason, { selector: 'select' }), 'harassment');
    await userEvent.type(screen.getByLabelText(t.note, { exact: false }), '  nội dung xấu  ');
    await userEvent.click(screen.getByRole('button', { name: t.submit, hidden: true }));

    await waitFor(() => expect(screen.getByRole('status', { hidden: true }).textContent).toBe(t.sent));
    expect(calls).toEqual([
      {
        path: '/api/community/reports',
        method: 'POST',
        body: { targetKind: 'trip', shareToken: 'tok-1', reason: 'harassment', note: 'nội dung xấu', website: '' },
      },
    ]);
  });

  it('posts a review report by id and leaves the note out when blank', async () => {
    const calls = stubFetch(() => json(201, { ok: true }));
    renderWithIntl(<ReportButton target={{ kind: 'review', id: 'rev-9' }} />);
    await userEvent.click(screen.getByRole('button', { name: t.buttonReview }));
    await userEvent.click(screen.getByRole('button', { name: t.submit, hidden: true }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toEqual({ targetKind: 'review', targetId: 'rev-9', reason: 'spam', website: '' });
  });

  it('forwards whatever a bot typed in the honeypot field', async () => {
    const calls = stubFetch(() => json(201, { ok: true }));
    renderWithIntl(<ReportButton target={{ kind: 'review', id: 'rev-9' }} />);
    await userEvent.click(screen.getByRole('button', { name: t.buttonReview }));
    const trap = document.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trap.tabIndex).toBe(-1);
    await userEvent.type(trap, 'http://spam.example');
    await userEvent.click(screen.getByRole('button', { name: t.submit, hidden: true }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0]!.body as { website: string }).website).toBe('http://spam.example');
  });

  it.each([
    [429, 'rate_limited', t.errors.rate_limited],
    [404, 'not_found', t.errors.not_found],
    [500, 'internal', t.errors.generic],
  ])('answers a %i (%s) with its own message and keeps the form open', async (status, code, text) => {
    stubFetch(() => json(status, { error: { code } }));
    renderWithIntl(<ReportButton target={{ kind: 'review', id: 'r' }} />);
    await userEvent.click(screen.getByRole('button', { name: t.buttonReview }));
    await userEvent.click(screen.getByRole('button', { name: t.submit, hidden: true }));
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toBe(text));
    expect(screen.getByRole('button', { name: t.submit, hidden: true })).toBeTruthy();
    expect(screen.queryByText(t.sent)).toBeNull();
  });

  it('disables the form while the request is in flight, so a double click sends one report', async () => {
    let release!: () => void;
    const calls = stubFetch(() => new Promise<Response>((resolve) => (release = () => resolve(json(201, { ok: true })))));
    renderWithIntl(<ReportButton target={{ kind: 'review', id: 'r' }} />);
    await userEvent.click(screen.getByRole('button', { name: t.buttonReview }));
    const submit = screen.getByRole('button', { name: t.submit, hidden: true }) as HTMLButtonElement;
    await userEvent.click(submit);
    await waitFor(() => expect(submit.disabled).toBe(true));
    await userEvent.click(submit);
    expect(calls).toHaveLength(1);
    release();
    await waitFor(() => expect(screen.getByText(t.sent)).toBeTruthy());
  });

  it('cancel closes the dialog without a request; reopening clears an old error', async () => {
    const calls = stubFetch(() => json(500, { error: { code: 'internal' } }));
    renderWithIntl(<ReportButton target={{ kind: 'review', id: 'r' }} />);
    const dialog = document.querySelector('dialog')!;
    await userEvent.click(screen.getByRole('button', { name: t.buttonReview }));
    await userEvent.click(screen.getByRole('button', { name: t.submit, hidden: true }));
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toBe(t.errors.generic));
    await userEvent.click(screen.getByRole('button', { name: t.cancel, hidden: true }));
    expect(dialog.hasAttribute('open')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: t.buttonReview }));
    expect(screen.getByRole('alert', { hidden: true }).textContent).toBe('');
    expect(calls).toHaveLength(1);
  });

  it('light-dismisses on a backdrop click but not on a click inside the form', async () => {
    stubFetch(() => json(201, { ok: true }));
    renderWithIntl(<ReportButton target={{ kind: 'review', id: 'r' }} />);
    const dialog = document.querySelector('dialog')!;
    await userEvent.click(screen.getByRole('button', { name: t.buttonReview }));
    await userEvent.click(screen.getByRole('heading', { name: t.title, hidden: true }));
    expect(dialog.hasAttribute('open')).toBe(true);
    await userEvent.click(dialog);
    expect(dialog.hasAttribute('open')).toBe(false);
  });
});
