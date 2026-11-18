import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

vi.mock('../src/i18n/navigation', () => ({
  getPathname: () => '/',
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => createElement('a', { href: String(href) }, children),
}));

const { activityBody, dayStates, tripsForPlace } = await import('../src/components/places/add-to-trip-logic');
const { PlaceAddToTrip } = await import('../src/components/places/place-add-to-trip');

const trip = { id: 't1', title: 'Đà Lạt 3 ngày', destinationSlug: 'da-lat', startDate: null, durationDays: 3, status: 'active' };
const place = { slug: 'cafe-a', destinationSlug: 'da-lat', suggestedMinutes: 90, estimatedCostVnd: 50_000 };

function keys(o: unknown, prefix = ''): string[] {
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('add to trip logic', () => {
  it('lists only active trips of the place destination', () => {
    const rows = [
      trip,
      { ...trip, id: 't2', destinationSlug: 'hue' },
      { ...trip, id: 't3', status: 'archived' },
    ];
    expect(tripsForPlace(rows, 'da-lat').map((row) => row.id)).toEqual(['t1']);
  });

  it('marks full days and days that already hold the place', () => {
    const full = Array.from({ length: 40 }, () => ({ placeSlug: null }));
    const states = dayStates(
      trip,
      { days: [{ dayNumber: 1, activities: full }, { dayNumber: 2, activities: [{ placeSlug: 'cafe-a' }] }] },
      'cafe-a',
    );
    expect(states).toEqual([
      { dayNumber: 1, full: true, hasPlace: false },
      { dayNumber: 2, full: false, hasPlace: true },
      { dayNumber: 3, full: false, hasPlace: false },
    ]);
  });

  it('without a snapshot every day is open', () => {
    expect(dayStates(trip, null, 'cafe-a').every((day) => !day.full && !day.hasPlace)).toBe(true);
  });

  it('builds the body from the place and clamps the duration', () => {
    expect(activityBody(place, 2)).toEqual({
      placeSlug: 'cafe-a',
      dayNumber: 2,
      durationMinutes: 90,
      estimatedCostVnd: 50_000,
      costScope: 'group',
      startTime: null,
    });
    expect(activityBody({ ...place, suggestedMinutes: 1 }, 1).durationMinutes).toBe(5);
    expect(activityBody({ ...place, suggestedMinutes: 9_999 }, 1).durationMinutes).toBe(1440);
  });
});

describe('add to trip component', () => {
  it('starts neutral, with no button and no guessed permissions', () => {
    for (const locale of ['vi', 'en'] as const) {
      const html = renderToStaticMarkup(
        createElement(
          NextIntlClientProvider,
          { locale, timeZone: 'Asia/Ho_Chi_Minh', messages: locale === 'vi' ? vi_ : en_ } as unknown as React.ComponentProps<typeof NextIntlClientProvider>,
          createElement(PlaceAddToTrip, { place: { ...place, name: 'Cà phê A' } }),
        ),
      );
      expect(html).toContain('role="status"');
      expect(html).not.toContain('<button');
      expect(html).not.toContain('href="#"');
    }
  });

  it('has the same message keys in VI and EN', () => {
    expect(keys(vi_.places.addToTrip).sort()).toEqual(keys(en_.places.addToTrip).sort());
  });
});
