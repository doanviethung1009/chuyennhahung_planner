// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordShell } from '../../src/components/admin/content/record-shell';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={String(href)}>{children}</a>,
  useRouter: () => ({ push }),
  usePathname: () => '/',
  getPathname: () => '/',
}));

const t = messages.vi.adminContent.places.delete;
const te = messages.vi.adminContent.errors;
const PATH = '/api/admin/travel/places/da-lat-cafe';
const record = { slug: 'da-lat-cafe', name: { vi: 'Quán Đà Lạt', en: 'Da Lat Cafe' }, updatedAt: '2026-11-19T00:00:00.000Z' };

function shell(canDelete: boolean) {
  return renderWithIntl(
    <RecordShell apiPath={PATH} statusPath={null} fields={['name']} lifecycle={false} back="places" canDelete={canDelete}>
      {() => null}
    </RecordShell>,
  );
}


describe('Delete place control (CORE-10)', () => {
  useDomCleanup();

  it('is not rendered when the role may not delete', async () => {
    stubFetch(() => json(200, record));
    shell(false);
    await screen.findByText(messages.vi.adminContent.form.save);
    expect(screen.queryByRole('button', { name: t.button })).toBeNull();
    expect(screen.queryByText(t.dangerTitle)).toBeNull();
  });

  it('is a real, labelled button when the role may delete, and opens a confirm dialog without calling the API', async () => {
    const calls = stubFetch(() => json(200, record));
    shell(true);
    const button = await screen.findByRole('button', { name: t.button });
    expect(button.tagName).toBe('BUTTON');
    expect(button.className).toContain('min-h-11');
    await userEvent.click(button);
    const dialog = document.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByRole('heading', { name: t.confirmTitle, hidden: true }).id);
    expect(screen.getByText(/Quán Đà Lạt/, { selector: 'p' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t.cancel, hidden: true }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('confirming sends DELETE to the place URL and returns to the list', async () => {
    const calls = stubFetch((call) => (call.method === 'DELETE' ? json(204, null) : json(200, record)));
    shell(true);
    await userEvent.click(await screen.findByRole('button', { name: t.button }));
    await userEvent.click(screen.getByRole('button', { name: t.confirm, hidden: true }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/content/places'));
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([{ path: PATH, method: 'DELETE', body: undefined }]);
  });

  it('a 409 place_in_use shows the message with only the non-zero counts, in an alert', async () => {
    stubFetch((call) =>
      call.method === 'DELETE'
        ? json(409, {
            error: {
              code: 'place_in_use',
              details: { counts: { stories: 2, collections: 0, templates: 0, contentReviews: 0, tripActivities: 5, communityReviews: 0 } },
            },
          })
        : json(200, record),
    );
    push.mockClear();
    shell(true);
    await userEvent.click(await screen.findByRole('button', { name: t.button }));
    await userEvent.click(screen.getByRole('button', { name: t.confirm, hidden: true }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(te.place_in_use);
    expect(alert.textContent).toContain('bài viết 2');
    expect(alert.textContent).toContain('hoạt động trong chuyến đi 5');
    expect(alert.textContent).not.toContain('bộ sưu tập');
    expect(push).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(false);
  });

  it('a 403 shows the forbidden message', async () => {
    stubFetch((call) => (call.method === 'DELETE' ? json(403, { error: { code: 'forbidden' } }) : json(200, record)));
    shell(true);
    await userEvent.click(await screen.findByRole('button', { name: t.button }));
    await userEvent.click(screen.getByRole('button', { name: t.confirm, hidden: true }));
    expect((await screen.findByRole('alert')).textContent).toBe(te.forbidden);
  });

  it('a 503 (usage could not be verified) shows the generic error, stays on the page and re-enables the button', async () => {
    stubFetch((call) =>
      call.method === 'DELETE' ? json(503, { error: { code: 'service_unavailable' } }) : json(200, record),
    );
    push.mockClear();
    shell(true);
    await userEvent.click(await screen.findByRole('button', { name: t.button }));
    await userEvent.click(screen.getByRole('button', { name: t.confirm, hidden: true }));
    expect((await screen.findByRole('alert')).textContent).toBe(te.generic);
    expect(push).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(false);
    expect((screen.getByRole('button', { name: t.button }) as HTMLButtonElement).disabled).toBe(false);
  });
});
