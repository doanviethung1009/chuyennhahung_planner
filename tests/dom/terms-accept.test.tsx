// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TermsAccept } from '../../src/components/planner/terms-accept';
import { termsVersion } from '../../src/content/site';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

const t = messages.vi.creatorTerms;
const label = t.label.replace('{version}', termsVersion);

function setup(respond: Parameters<typeof stubFetch>[0], locale: 'vi' | 'en' = 'vi') {
  const calls = stubFetch(respond);
  const onChange = vi.fn();
  const onUnauthorized = vi.fn();
  renderWithIntl(<TermsAccept onChange={onChange} onUnauthorized={onUnauthorized} />, locale);
  return { calls, onChange, onUnauthorized };
}

const status = (accepted: boolean) => json(200, { version: termsVersion, accepted, acceptedAt: accepted ? '2026-01-01T00:00:00Z' : null });

describe('TermsAccept', () => {
  useDomCleanup();

  it('shows a disabled "checking" box while the status loads, then an enabled unchecked box', async () => {
    const { onChange } = setup(() => status(false));
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    const box = (await screen.findByRole('checkbox', { name: label })) as HTMLInputElement;
    await waitFor(() => expect(box.disabled).toBe(false));
    expect(box.checked).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('shows only the confirmation, with the version, when the member has already accepted', async () => {
    const { onChange } = setup(() => status(true));
    expect(await screen.findByText(t.accepted.replace('{version}', termsVersion))).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('records acceptance with one POST of the current version and the page language, then reports true', async () => {
    const { calls, onChange } = setup((call) => (call.method === 'POST' ? json(200, { ok: true }) : status(false)), 'en');
    const box = await screen.findByRole('checkbox');
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    await userEvent.click(box);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true));
    expect(calls.filter((c) => c.method === 'POST')).toEqual([
      { path: '/api/planner/terms', method: 'POST', body: { version: termsVersion, lang: 'en' } },
    ]);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('does not report acceptance when the POST fails, and says so', async () => {
    const { onChange } = setup((call) => (call.method === 'POST' ? json(500, { error: { code: 'internal' } }) : status(false)));
    const box = await screen.findByRole('checkbox');
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    await userEvent.click(box);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.error));
    expect(onChange).not.toHaveBeenCalledWith(true);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('hands a 401 on the status lookup to onUnauthorized', async () => {
    const { onUnauthorized } = setup(() => json(401, { error: { code: 'unauthorized' } }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it('hands a 401 on the POST to onUnauthorized instead of showing the error', async () => {
    const { onUnauthorized, onChange } = setup((call) => (call.method === 'POST' ? json(401, { error: { code: 'unauthorized' } }) : status(false)));
    const box = await screen.findByRole('checkbox');
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    await userEvent.click(box);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(onChange).not.toHaveBeenCalledWith(true);
  });
});
