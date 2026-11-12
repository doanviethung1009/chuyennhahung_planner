import { describe, expect, it } from 'vitest';
import { locales, pathnames, routing } from '../src/i18n/routing';
import { footerExtraNav, primaryNav } from '../src/components/layout/nav-items';
import vi from '../messages/vi.json';

describe('route topology', () => {
  it('defines every pathname in every locale', () => {
    for (const [canonical, value] of Object.entries(pathnames)) {
      if (typeof value === 'string') continue;
      for (const locale of locales) {
        const localized = (value as Record<string, string>)[locale];
        expect(localized, `${canonical} is missing ${locale}`).toBeTruthy();
      }
    }
  });

  it('keeps dynamic segments identical across locales', () => {
    const segments = (path: string) => [...path.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);

    for (const [canonical, value] of Object.entries(pathnames)) {
      if (typeof value === 'string') continue;
      const expected = segments(canonical);
      for (const locale of locales) {
        const localized = (value as Record<string, string>)[locale]!;
        expect(segments(localized), `${canonical} / ${locale}`).toEqual(expected);
      }
    }
  });

  it('produces no duplicate URL within a locale', () => {
    for (const locale of locales) {
      const urls = Object.values(pathnames).map((value) =>
        typeof value === 'string' ? value : (value as Record<string, string>)[locale]!,
      );
      expect(new Set(urls).size, `duplicate URL in ${locale}`).toBe(urls.length);
    }
  });

  it('keeps Vietnamese unprefixed as the default locale', () => {
    expect(routing.defaultLocale).toBe('vi');
    expect(routing.localePrefix).toBe('as-needed');
  });

  it('does not auto-switch locale from Accept-Language', () => {
    // Deliberate: a Vietnamese visitor with an English-configured browser
    // must still land on the Vietnamese page.
    expect(routing.localeDetection).toBe(false);
  });

  it('points every navigation entry at a real, static route', () => {
    for (const item of [...primaryNav, ...footerExtraNav]) {
      expect(pathnames, `nav "${item.key}" → unknown route`).toHaveProperty(item.href);
      expect(item.href, `nav "${item.key}" is a dynamic route`).not.toContain('[');
      expect(vi.nav, `nav "${item.key}" has no label`).toHaveProperty(item.key);
    }
  });

  it('exposes all six primary navigation entries', () => {
    expect(primaryNav.map((item) => item.key)).toEqual([
      'home',
      'stories',
      'destinations',
      'itineraries',
      'reviews',
      'about',
    ]);
  });

  it('localizes the admin content routes under the admin prefix', () => {
    expect(pathnames['/admin/content/stories']).toEqual({
      vi: '/quan-tri/noi-dung/chuyen-di',
      en: '/admin/content/stories',
    });
    expect(pathnames['/admin/content/places'].vi).toBe('/quan-tri/noi-dung/dia-diem');
    expect(pathnames['/admin/content/reviews'].vi).toBe('/quan-tri/noi-dung/danh-gia');
    expect(pathnames['/admin/content/stories/[slug]'].vi).toBe('/quan-tri/noi-dung/chuyen-di/[slug]');
    expect(pathnames['/admin/content/places/[slug]'].vi).toBe('/quan-tri/noi-dung/dia-diem/[slug]');
  });
});
