import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock('../src/i18n/navigation', () => ({ getPathname: () => '/' }));
vi.mock('../src/content/site', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  contributionOpen: true,
  contribution: { terms: null, takedownContact: null },
}));

const { ReviewForm } = await import('../src/components/reviews/review-form');
const { PlaceReviewSection } = await import('../src/components/places/place-review-section');

const place = { slug: 'cafe-a', name: 'Cà phê A' };
const wrap = (locale: 'vi' | 'en', node: React.ReactElement) =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, { locale, timeZone: 'Asia/Ho_Chi_Minh', messages: locale === 'vi' ? vi_ : en_ } as unknown as React.ComponentProps<typeof NextIntlClientProvider>, node),
  );

describe('place review section', () => {
  it('guest form with a fixed place has no place dropdown and shows the place name', () => {
    const html = wrap('en', createElement(ReviewForm, { mode: 'guest', places: [], fixedPlace: place }));
    expect(html).toContain('Cà phê A');
    expect(html).not.toContain('Choose a place');
    expect(html).toContain('aria-hidden="true"');
  });

  it('guest form without fixedPlace keeps the dropdown (home page unchanged)', () => {
    const html = wrap('en', createElement(ReviewForm, { mode: 'guest', places: [place] }));
    expect(html).toContain('Choose a place');
  });

  it('starts in a neutral loading state, not a guess at permissions', () => {
    for (const locale of ['vi', 'en'] as const) {
      const html = wrap(locale, createElement(PlaceReviewSection, { place }));
      expect(html).toContain('role="status"');
      expect(html).not.toContain('<form');
    }
  });

  it('has VI and EN strings for the new keys', () => {
    for (const m of [vi_, en_]) {
      expect(m.communityReviews.placePage.writeTitle).toBeTruthy();
      expect(m.communityReviews.placePage.yourReview).toBeTruthy();
      expect(m.communityReviews.placePage.loading).toBeTruthy();
    }
  });
});
