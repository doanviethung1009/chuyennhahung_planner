import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { HomeMember } from '../src/server/planner/home-page';

/**
 * The member band as rendered markup (docs/specs-home-mvp.md A-1, A-5, A-12).
 * `next-intl/server` and the localized `Link` need a Next request, so they are
 * replaced by tiny stand-ins: the message key (with its params) becomes the
 * text, and a pathname with params becomes a plain href.
 */
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string, params?: Record<string, unknown>) =>
    `${namespace}.${key}${params ? JSON.stringify(params) : ''}`,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    className,
    children,
  }: {
    href: string | { pathname: string; params: Record<string, string> };
    className?: string;
    children: React.ReactNode;
  }) => {
    const target =
      typeof href === 'string'
        ? href
        : href.pathname.replace(/\[(\w+)\]/g, (_m, key: string) => href.params[key] ?? '');
    return createElement('a', { href: target, className }, children);
  },
}));

const { HomeMemberBand } = await import('../src/components/home/home-member-band');

async function render(member: HomeMember, locale: 'vi' | 'en' = 'vi'): Promise<string> {
  const element = (await HomeMemberBand({ member, locale })) as ReactElement | null;
  return element ? renderToStaticMarkup(element) : '';
}

const trip = {
  id: 'trip_abc',
  title: 'Đà Lạt cuối tuần',
  destinationSlug: 'da-lat',
  durationDays: 3,
  startDate: '2026-12-20' as string | null,
  daysUntilStart: 33 as number | null,
  planningStatus: 'draft' as const,
};

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe('HomeMemberBand', () => {
  it('renders nothing at all for a guest, leaving the public page untouched', async () => {
    expect(await render({ status: 'guest' })).toBe('');
  });

  it('links Continue Planning to the trip and to My Trips', async () => {
    const html = await render({ status: 'continue', trip });
    expect(hrefs(html)).toEqual(['/my-trips/trip_abc', '/my-trips']);
    expect(html).toContain('Đà Lạt cuối tuần');
    expect(html).toContain('home.member.countdown{&quot;count&quot;:33}');
  });

  it('sends first-trip and next-trip members to the new-trip form', async () => {
    for (const status of ['first-trip', 'next-trip'] as const) {
      expect(hrefs(await render({ status }))).toEqual(['/my-trips/new']);
    }
    expect(await render({ status: 'first-trip' })).toContain('home.member.firstTitle');
    expect(await render({ status: 'next-trip' })).toContain('home.member.nextTitle');
  });

  it('adds no heading and no h1, so the hero keeps the page’s only h1', async () => {
    for (const member of [
      { status: 'first-trip' },
      { status: 'next-trip' },
      { status: 'continue', trip },
    ] as HomeMember[]) {
      const html = await render(member);
      expect(html).not.toMatch(/<h[1-6][\s>]/);
    }
  });

  it('labels the section with the element that carries its title', async () => {
    const html = await render({ status: 'continue', trip });
    expect(html).toMatch(/<section[^>]*aria-labelledby="home-member-heading"/);
    expect(html).toMatch(/<p[^>]*id="home-member-heading"[^>]*>Đà Lạt cuối tuần<\/p>/);
  });

  it('keeps every control at the 44px touch-target size or more', async () => {
    const html = await render({ status: 'continue', trip });
    for (const link of html.match(/<a [^>]*>/g) ?? []) {
      expect(link).toMatch(/min-h-1[1-3]/);
    }
  });

  it('says when a trip leaves today and when it has no date', async () => {
    expect(await render({ status: 'continue', trip: { ...trip, daysUntilStart: 0 } })).toContain(
      'home.member.leavingToday',
    );
    expect(
      await render({ status: 'continue', trip: { ...trip, startDate: null, daysUntilStart: null } }),
    ).toContain('home.member.noDate');
  });

  it('shows the date of a trip whose date has passed, without a countdown', async () => {
    const html = await render({
      status: 'continue',
      trip: { ...trip, startDate: '2026-06-01', daysUntilStart: null },
    });
    expect(html).not.toContain('countdown');
    expect(html).toMatch(/2026/);
  });

  it('renders a title as text, never as markup', async () => {
    const html = await render({
      status: 'continue',
      trip: { ...trip, title: '<img src=x onerror=alert(1)>' },
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
