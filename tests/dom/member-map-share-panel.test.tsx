// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberMapSharePanel } from '../../src/components/map/member-map-share-panel';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup, type FetchCall } from './helpers';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={String(href)}>{children}</a>,
  getPathname: ({ href }: { href: string | { pathname: string; params: Record<string, string> } }) =>
    typeof href === 'string' ? href : href.pathname.replace(/\[(\w+)\]/g, (_m, k: string) => href.params[k] ?? ''),
}));

const t = messages.vi.memberMapShare;
const TOKEN = 'T'.repeat(43);
const off = { enabled: false, shareName: 'anonymous', visitedPlaces: 1, sparse: true };
const on = { ...off, enabled: true };
const PREVIEW = <p data-testid="preview-slot">xem trước</p>;

function stub(handler: (call: FetchCall) => Response | Promise<Response>, initial: object = off) {
  return stubFetch((call) => (call.method === 'GET' ? json(200, initial) : handler(call)));
}

describe('MemberMapSharePanel', () => {
  useDomCleanup();

  it('shows the off state with an enable button, anonymous selected, and the preview slot', async () => {
    stub(() => json(200, off));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    expect((await screen.findByTestId('share-state')).textContent).toBe(t.stateOff);
    expect(screen.getByRole('button', { name: t.enable })).toBeTruthy();
    expect((screen.getByLabelText(t.nameAnonymous) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('preview-slot')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: t.title })).toBeTruthy();
  });

  it('shows the preview even while the status is loading', () => {
    stubFetch(() => new Promise<Response>(() => {}));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    expect(screen.getByText(t.loading)).toBeTruthy();
    expect(screen.getByTestId('preview-slot')).toBeTruthy();
  });

  it('enabling shows the link once, with a real copy button, and hides it for good after "done"', async () => {
    const calls = stub(() => json(200, { ...on, token: TOKEN }));
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    await userEvent.click(await screen.findByRole('button', { name: t.enable }));

    const input = (await screen.findByLabelText(t.linkLabel)) as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/shared-map/${TOKEN}`);
    expect(calls.at(-1)).toEqual({ path: '/api/planner/map/share', method: 'PUT', body: { enabled: true, shareName: 'anonymous' } });
    expect(document.activeElement?.textContent).toBe(t.issuedTitle);

    await userEvent.click(screen.getByRole('button', { name: t.copy }));
    expect(writeText).toHaveBeenCalledWith(input.value);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.copied));

    await userEvent.click(screen.getByRole('button', { name: t.issuedDone }));
    expect(screen.queryByLabelText(t.linkLabel)).toBeNull();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(screen.getByText(t.linkHidden)).toBeTruthy();
    expect((await screen.findByTestId('share-state')).textContent).toBe(t.stateOn);
  });

  it('does not keep the token in the URL or in browser storage', async () => {
    stub(() => json(200, { ...on, token: TOKEN }));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    await userEvent.click(await screen.findByRole('button', { name: t.enable }));
    await screen.findByLabelText(t.linkLabel);
    expect(window.location.href).not.toContain(TOKEN);
    expect(JSON.stringify({ ...localStorage })).not.toContain(TOKEN);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(TOKEN);
  });

  it('an already shared map never shows a link on load, only the notice and rotate/revoke', async () => {
    stub(() => json(200, on), on);
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    expect((await screen.findByTestId('share-state')).textContent).toBe(t.stateOn);
    expect(screen.queryByLabelText(t.linkLabel)).toBeNull();
    expect(screen.getByText(t.linkHidden)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.rotate })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.revoke })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.enable })).toBeNull();
  });

  it('rotating asks first; cancelling sends nothing; confirming shows the new link once', async () => {
    const calls = stub(() => json(200, { ...on, token: TOKEN }), on);
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    await userEvent.click(await screen.findByRole('button', { name: t.rotate }));
    expect(screen.getByRole('heading', { name: t.rotateConfirmTitle })).toBeTruthy();
    expect(document.activeElement?.textContent).toBe(t.rotateCancel);

    await userEvent.click(screen.getByRole('button', { name: t.rotateCancel }));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: t.rotate }));
    await userEvent.click(screen.getByRole('button', { name: t.rotateConfirm }));
    expect(((await screen.findByLabelText(t.linkLabel)) as HTMLInputElement).value).toContain(TOKEN);
    expect(calls.find((c) => c.method === 'POST')).toEqual({ path: '/api/planner/map/share/rotate', method: 'POST', body: undefined });
  });

  it('revoking drops a link still on screen and returns to the off state', async () => {
    const calls = stub((call) => (call.method === 'DELETE' ? json(200, off) : json(200, { ...on, token: TOKEN })));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    await userEvent.click(await screen.findByRole('button', { name: t.enable }));
    await screen.findByLabelText(t.linkLabel);
    await userEvent.click(screen.getByRole('button', { name: t.revoke }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.revoked));
    expect(screen.queryByLabelText(t.linkLabel)).toBeNull();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(screen.getByTestId('share-state').textContent).toBe(t.stateOff);
    expect(calls.at(-1)!.method).toBe('DELETE');
  });

  it('refuses to pretend "show my name" works: 403 share_name_unavailable disables it and keeps anonymous', async () => {
    stub(() => json(403, { error: { code: 'forbidden', reason: 'share_name_unavailable' } }));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    await userEvent.click(await screen.findByLabelText(t.nameShown));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(t.errorNameUnavailable));
    const radio = screen.getByLabelText(t.nameShown) as HTMLInputElement;
    expect(radio.disabled).toBe(true);
    expect(radio.checked).toBe(false);
    expect((screen.getByLabelText(t.nameAnonymous) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(t.nameUnavailableNote)).toBeTruthy();
  });

  it.each([
    [401, { error: { code: 'unauthorized' } }, {}, t.errorUnauthorized],
    [403, { error: { code: 'forbidden' } }, {}, t.errorForbidden],
    [422, { error: { code: 'validation_failed', reason: 'display_name_unsuitable' } }, {}, t.errorNameUnsuitable],
    [422, { error: { code: 'validation_failed' } }, {}, t.errorInvalid],
    [429, { error: { code: 'rate_limited' } }, { 'retry-after': '1800' }, t.errorRateLimited.replace('{minutes}', '30')],
    [500, { error: { code: 'internal' } }, {}, t.errorGeneric],
  ])('maps a %s answer to a clear message', async (status, body, headers, text) => {
    stub(() => json(status, body, headers));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    await userEvent.click(await screen.findByRole('button', { name: t.enable }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(text));
    expect(screen.queryByLabelText(t.linkLabel)).toBeNull();
    if (status === 401) expect(screen.getByRole('button', { name: t.signIn })).toBeTruthy();
  });

  it('says so when the status cannot be loaded', async () => {
    stubFetch(() => json(500, { error: { code: 'internal' } }));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />);
    expect(await screen.findByText(t.errorLoad)).toBeTruthy();
  });

  it('renders in English with every key present', async () => {
    stub(() => json(200, off));
    renderWithIntl(<MemberMapSharePanel preview={PREVIEW} />, 'en');
    expect(await screen.findByRole('button', { name: messages.en.memberMapShare.enable })).toBeTruthy();
  });
});

describe('memberMapShare catalogue', () => {
  it('has the same keys in Vietnamese and English, none empty', () => {
    expect(Object.keys(messages.vi.memberMapShare).sort()).toEqual(Object.keys(messages.en.memberMapShare).sort());
    for (const lang of ['vi', 'en'] as const) {
      for (const value of Object.values(messages[lang].memberMapShare)) expect(String(value).trim()).not.toBe('');
    }
  });
});
