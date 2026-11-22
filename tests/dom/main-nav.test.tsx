// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, messages, renderWithIntl, stubFetch, useDomCleanup } from './helpers';

const pathname = '/places';
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => ({}),
  usePathname: () => pathname,
}));
vi.mock('../../src/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/i18n/navigation')>()),
  usePathname: () => pathname,
}));

import { MainNav, type NavEntryView } from '../../src/components/layout/main-nav';

const t = messages.vi.nav;
const items: NavEntryView[] = [
  { key: 'stories', href: '/stories', label: t.stories },
  {
    key: 'groupExplore',
    label: t.groupExplore,
    items: [
      { key: 'destinations', href: '/destinations', label: t.destinations },
      { key: 'places', href: '/places', label: t.places },
      { key: 'map', href: '/map', label: t.map },
    ],
  },
  {
    key: 'groupPlan',
    label: t.groupPlan,
    items: [
      { key: 'itineraries', href: '/itineraries', label: t.itineraries },
      { key: 'tripTemplates', href: '/trip-templates', label: t.tripTemplates },
    ],
  },
];

function renderNav() {
  return renderWithIntl(
    <MainNav
      items={items}
      guestCta={{ href: '/plan-your-trip', label: t.planTrip }}
      memberCta={{ href: '/my-trips/new', label: t.createTrip }}
      openLabel={t.openMenu}
      closeLabel={t.closeMenu}
      navLabel={t.primary}
    />,
  );
}

const ctaLink = (label: string) => screen.getAllByText(label).map((el) => el.closest('a')!);

describe('MainNav (UXS-2)', () => {
  useDomCleanup();

  it('gives a guest the planner page, and never shows the member label', async () => {
    stubFetch(() => json(401, {}));
    renderNav();
    await waitFor(() => expect(ctaLink(t.planTrip)[0]!.getAttribute('aria-hidden')).toBeNull());
    expect(ctaLink(t.planTrip)[0]!.getAttribute('href')).toBe('/thiet-ke-chuyen-di');
    expect(screen.queryByText(t.createTrip)).toBeNull();
  });

  it('holds the CTA hidden and out of the tab order while the session loads', () => {
    stubFetch(() => new Promise<Response>(() => {}));
    renderNav();
    const cta = ctaLink(t.planTrip)[0]!;
    expect(cta.getAttribute('aria-hidden')).toBe('true');
    expect(cta.tabIndex).toBe(-1);
    expect(cta.className).toContain('invisible');
  });

  it('sends a signed-in member to the new-trip page with a matching label', async () => {
    stubFetch(() => json(200, { user: { displayName: 'Lan', role: 'member', hasPassword: true } }));
    renderNav();
    await waitFor(() => expect(screen.getAllByText(t.createTrip).length).toBeGreaterThan(0));
    expect(ctaLink(t.createTrip)[0]!.getAttribute('href')).toBe('/chuyen-di-cua-toi/moi');
    expect(screen.queryByText(t.planTrip)).toBeNull();
  });

  it('opens a group as a disclosure with places and the map, and Escape closes it', async () => {
    stubFetch(() => json(401, {}));
    const user = userEvent.setup();
    renderNav();
    const trigger = screen.getAllByRole('button', { name: t.groupExplore })[0]!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const list = document.getElementById(trigger.getAttribute('aria-controls')!)!;
    const links = within(list).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/kham-pha', '/dia-diem', '/ban-do']);
    // The current page is marked inside the group.
    expect(within(list).getByRole('link', { name: t.places }).getAttribute('aria-current')).toBe('page');
    await user.keyboard('{Escape}');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });
});
