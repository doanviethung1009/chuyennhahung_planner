// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { messages, renderWithIntl, useDomCleanup } from './helpers';

let pathname = '/stories';
let params: Record<string, string> = {};
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => params,
  usePathname: () => pathname,
}));
vi.mock('../../src/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/i18n/navigation')>()),
  usePathname: () => pathname,
}));

import { LocaleSwitcher } from '../../src/components/layout/locale-switcher';

const t = messages.vi.locale;

describe('LocaleSwitcher (CORE-12 / P-5, S-5)', () => {
  useDomCleanup();

  it('links Vietnamese without a /vi prefix and English with /en, from either locale', () => {
    renderWithIntl(<LocaleSwitcher />, 'en');
    const links = screen.getAllByRole('link');
    const vi = links.find((a) => a.getAttribute('hreflang') === 'vi')!;
    const en = links.find((a) => a.getAttribute('hreflang') === 'en')!;
    expect(vi.getAttribute('href')).toBe('/chuyen-di-choi');
    expect(en.getAttribute('href')).toBe('/en/stories');
    expect(vi.getAttribute('href')).not.toMatch(/^\/vi(\/|$)/);
  });

  it('rebuilds a dynamic page from its params and marks the current locale', () => {
    pathname = '/stories/[slug]';
    params = { slug: 'di-da-lat' };
    renderWithIntl(<LocaleSwitcher />, 'vi');
    const links = screen.getAllByRole('link');
    expect(links.find((a) => a.getAttribute('hreflang') === 'vi')!.getAttribute('href')).toBe('/chuyen-di-choi/di-da-lat');
    expect(links.find((a) => a.getAttribute('hreflang') === 'en')!.getAttribute('href')).toBe('/en/stories/di-da-lat');
    expect(screen.getByRole('link', { name: t.vi }).getAttribute('aria-current')).toBe('true');
  });

  it('gives each link a 44px minimum target', () => {
    renderWithIntl(<LocaleSwitcher />, 'vi');
    for (const a of screen.getAllByRole('link')) {
      expect(a.className).toContain('min-h-11');
      expect(a.className).toContain('min-w-11');
    }
  });

  it('keeps the query string (and a returnTo) on the other-language link (UXA-05)', () => {
    pathname = '/my-trips';
    params = {};
    window.history.replaceState(null, '', '/chuyen-di-cua-toi?tab=trips&page=2');
    renderWithIntl(<LocaleSwitcher />, 'vi');
    const en = screen.getAllByRole('link').find((a) => a.getAttribute('hreflang') === 'en')!;
    expect(en.getAttribute('href')).toBe('/en/my-trips?tab=trips&page=2');

    pathname = '/sign-in';
    window.history.replaceState(null, '', '/dang-nhap?returnTo=%2Fchuyen-di-cua-toi');
    fireEvent.pointerDown(en);
    expect(en.getAttribute('href')).toBe('/en/sign-in?returnTo=%2Fchuyen-di-cua-toi');
  });

  it('is the plain page link before the address bar is read (works without JS)', () => {
    window.history.replaceState(null, '', '/');
    pathname = '/stories';
    renderWithIntl(<LocaleSwitcher />, 'vi');
    const en = screen.getAllByRole('link').find((a) => a.getAttribute('hreflang') === 'en')!;
    expect(en.getAttribute('href')).toBe('/en/stories');
  });
});
