import { test, expect } from './support/test';
import { expectHealthyPage, VIEWPORTS } from './support/page-checks';

// Public, read-only pages. The content store starts empty and auto-seeds the demo
// stories, places and templates on first use, so nothing here needs a fixture.
const VI_ROUTES = [
  '/',
  '/chuyen-di-choi',
  '/chuyen-di-choi/ba-ngay-o-ha-giang-khong-co-ke-hoach',
  '/kham-pha',
  '/dia-diem',
  '/dia-diem/ba-na-hills',
  '/lich-trinh-mau',
  '/thiet-ke-chuyen-di',
  '/ban-do',
];

const EN_ROUTES = ['/en', '/en/stories', '/en/places', '/en/trip-templates', '/en/plan-your-trip', '/en/map'];

test.describe('public pages @smoke', () => {
  test('Vietnamese pages at 375, 768 and 1280px: one h1, no overflow, no dead links', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of VI_ROUTES) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        await expectHealthyPage(page, `${route} @${viewport.name}`);
      }
    }
  });

  test('English pages: one h1, no overflow, no dead links', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of EN_ROUTES) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expectHealthyPage(page, `${route} @${viewport.name}`);
      }
    }
  });

  test('place search ignores diacritics: "da lat" and "Đà Lạt" return the same places', async ({ page }) => {
    const slugsFor = async (query: string): Promise<string[]> => {
      await page.goto(`/dia-diem?q=${encodeURIComponent(query)}`);
      await expect(page.locator('h1')).toHaveCount(1);
      const hrefs = await page.locator('main a[href^="/dia-diem/"]').evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
      );
      return [...new Set(hrefs)].sort();
    };
    const plain = await slugsFor('da lat');
    const accented = await slugsFor('Đà Lạt');
    expect(plain.length).toBeGreaterThan(0);
    expect(accented).toEqual(plain);
  });

  test('plan-your-trip links to real next steps; legacy tour URLs redirect (rule 2)', async ({ page, request }) => {
    await page.goto('/thiet-ke-chuyen-di');
    await expect(page.locator('main a[href="/lich-trinh-mau"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/chuyen-di-cua-toi/moi"]').first()).toBeVisible();
    await expect(page.locator('main a[href^="mailto:"]').first()).toBeVisible();
    await page.goto('/en/plan-your-trip');
    await expect(page.locator('main a[href="/en/trip-templates"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/en/my-trips/new"]').first()).toBeVisible();

    // Tour routes are permanent: 308 into the itinerary routes.
    const expected: Record<string, string> = {
      '/tour': '/len-lich-trinh',
      '/tours': '/len-lich-trinh',
      '/tour/x': '/len-lich-trinh/x',
      '/tours/x': '/len-lich-trinh/x',
    };
    for (const [from, to] of Object.entries(expected)) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(new URL(response.headers().location ?? '', 'http://x').pathname, from).toBe(to);
    }
  });
});
