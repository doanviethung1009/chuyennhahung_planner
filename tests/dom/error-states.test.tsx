// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LocaleError from '../../src/app/[locale]/error';
import GlobalError from '../../src/app/global-error';
import { StateNotice } from '../../src/components/ui/state-notice';
import { TripDetail } from '../../src/components/planner/trip-detail';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

// The stylesheet is Tailwind/PostCSS; component tests do not build CSS.
vi.mock('../../src/app/globals.css', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  getPathname: () => '/',
}));

const vi_ = messages.vi;
const en_ = messages.en;

describe('StateNotice', () => {
  useDomCleanup();

  it('an error is announced (role=alert) and an empty state is not', () => {
    const { rerender } = renderWithIntl(<StateNotice tone="error" title="Lỗi" body="Không tải được" />);
    expect(screen.getByRole('alert').textContent).toContain('Lỗi');
    rerender(<StateNotice title="Rỗng" body="Chưa có gì" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens with an h2 by default and with the page h1 only when asked', () => {
    const { rerender } = renderWithIntl(<StateNotice title="A" body="b" />);
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
    rerender(<StateNotice level={1} title="A" body="b" />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });
});

describe('route error boundary', () => {
  useDomCleanup();

  it('shows one h1 and an alert, retries on click, links home, and never prints the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2'), { digest: 'd123' });
    const { container } = renderWithIntl(<LocaleError error={error} reset={reset} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(vi_.states.errorTitle);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(container.textContent).not.toContain('ECONNREFUSED');
    expect(container.textContent).not.toContain('hunter2');

    await userEvent.click(screen.getByRole('button', { name: vi_.states.retry }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: vi_.states.backHome }).getAttribute('href')).toBe('/');
    expect(console.error).toHaveBeenCalledWith('route error', 'd123');
  });

  it('speaks English under en', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithIntl(<LocaleError error={new Error('x')} reset={() => {}} />, 'en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(en_.states.errorTitle);
  });
});

describe('global error boundary', () => {
  useDomCleanup();

  it('renders from the catalogue, in Vietnamese by default, with a real link home', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // `html` cannot be rendered into a div; the body content is what matters here.
    renderWithIntl(<GlobalError error={new Error('x')} reset={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(vi_.states.errorTitle);
    expect(screen.getByRole('link', { name: vi_.states.backHome }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('button', { name: vi_.states.retry })).toBeTruthy();
  });
});

describe('TripDetail load failures (UXA-12)', () => {
  useDomCleanup();

  it('a failed read says so, offers a retry, and the retry reads again', async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      return json(500, { error: { code: 'internal_error', message: 'x' } });
    });
    renderWithIntl(<TripDetail id="trip_1" />);
    const t = vi_.tripDetail;
    await screen.findByRole('heading', { level: 1, name: t.errorTitle });
    expect(screen.getByRole('alert').textContent).toBe(t.error);
    expect(screen.queryByText(t.missingTitle)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: t.retry }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it('a missing trip keeps its own heading and has no retry', async () => {
    stubFetch(() => json(404, { error: { code: 'not_found', message: 'x' } }));
    renderWithIntl(<TripDetail id="trip_1" />);
    const t = vi_.tripDetail;
    await screen.findByRole('heading', { level: 1, name: t.missingTitle });
    expect(screen.queryByRole('button', { name: t.retry })).toBeNull();
    expect(screen.getByRole('link', { name: t.back })).toBeTruthy();
  });
});
