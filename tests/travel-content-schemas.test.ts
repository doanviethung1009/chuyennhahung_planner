import { describe, expect, it } from 'vitest';
import {
  dateRangeSchema,
  imageRefSchema,
  isoDateSchema,
  localizedTextSchema,
  placeCreateSchema,
  ratingSchema,
  reorderActivitiesSchema,
  slugSchema,
  storyCreateSchema,
  templateCreateSchema,
  tripCostSchema,
  vndSchema,
} from '../src/server/content/schemas';
import { placeFixture, storyFixture, templateFixture } from './travel-content-helpers';

describe('money is integer VND', () => {
  it('accepts whole đồng', () => {
    expect(vndSchema.parse(4_380_000)).toBe(4_380_000);
    expect(vndSchema.parse(0)).toBe(0);
  });

  it('rejects fractional amounts — cost accounting never sees a float', () => {
    expect(vndSchema.safeParse(120_000.5).success).toBe(false);
    expect(vndSchema.safeParse(0.01).success).toBe(false);
  });

  it('rejects negatives and implausible magnitudes', () => {
    expect(vndSchema.safeParse(-1).success).toBe(false);
    expect(vndSchema.safeParse(2e12).success).toBe(false);
  });

  it('rejects a cost line whose amount is a float', () => {
    const result = tripCostSchema.safeParse({
      partySize: 2,
      currency: 'VND',
      breakdown: [
        { category: 'food', label: { vi: 'Ăn', en: 'Food' }, amountVnd: 99_999.9 },
      ],
      note: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('localized fields require both locales', () => {
  it('accepts vi + en', () => {
    expect(localizedTextSchema.parse({ vi: 'Xin chào', en: 'Hello' })).toEqual({
      vi: 'Xin chào',
      en: 'Hello',
    });
  });

  it('rejects a Vietnamese-only string', () => {
    expect(localizedTextSchema.safeParse({ vi: 'Xin chào' }).success).toBe(false);
  });

  it('rejects an English-only string', () => {
    expect(localizedTextSchema.safeParse({ en: 'Hello' }).success).toBe(false);
  });

  it('rejects whitespace masquerading as a translation', () => {
    expect(localizedTextSchema.safeParse({ vi: 'Xin chào', en: '   ' }).success).toBe(
      false,
    );
  });
});

describe('slugs and dates', () => {
  it('accepts hyphenated lowercase slugs', () => {
    expect(slugSchema.parse('ba-ngay-lang-man-o-da-lat')).toBe(
      'ba-ngay-lang-man-o-da-lat',
    );
  });

  it.each(['Da-Lat', 'da--lat', '-da-lat', 'da-lat-', 'da lat', 'đà-lạt'])(
    'rejects "%s"',
    (value) => {
      expect(slugSchema.safeParse(value).success).toBe(false);
    },
  );

  it('rejects a date that does not exist on the calendar', () => {
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-13-01').success).toBe(false);
    expect(isoDateSchema.parse('2026-02-28')).toBe('2026-02-28');
  });

  it('rejects a travel range that ends before it starts', () => {
    expect(
      dateRangeSchema.safeParse({ start: '2026-02-15', end: '2026-02-13' }).success,
    ).toBe(false);
    expect(
      dateRangeSchema.safeParse({ start: '2026-02-13', end: '2026-02-13' }).success,
    ).toBe(true);
  });
});

describe('image references reject placeholders', () => {
  it('accepts a committed asset and an https URL', () => {
    expect(imageRefSchema.parse('/images/covers/da-lat.svg')).toBe(
      '/images/covers/da-lat.svg',
    );
    expect(imageRefSchema.parse('https://images.unsplash.com/photo-1')).toBeTruthy();
  });

  it.each(['#', '', 'images/covers/da-lat.svg', 'http://example.com/a.jpg', 'javascript:alert(1)'])(
    'rejects "%s"',
    (value) => {
      expect(imageRefSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('ratings land on a half star', () => {
  it.each([1, 3.5, 4, 4.5, 5])('accepts %s', (value) => {
    expect(ratingSchema.parse(value)).toBe(value);
  });

  it.each([0.5, 5.5, 4.3, 4.25])('rejects %s', (value) => {
    expect(ratingSchema.safeParse(value).success).toBe(false);
  });
});

describe('payload hygiene', () => {
  it('strips unknown keys rather than trusting them', () => {
    const parsed = placeCreateSchema.parse({
      ...placeFixture(),
      createdAt: '1999-01-01T00:00:00.000Z',
      isAdmin: true,
    });
    expect(parsed).not.toHaveProperty('createdAt');
    expect(parsed).not.toHaveProperty('isAdmin');
  });

  it('will not let a client set a story status or publish date', () => {
    const parsed = storyCreateSchema.parse({
      ...storyFixture(),
      status: 'published',
      publishedAt: '2020-01-01T00:00:00.000Z',
      actualCostTotalVnd: 1,
    });
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('publishedAt');
    expect(parsed).not.toHaveProperty('actualCostTotalVnd');
  });

  it('will not let a client set template derived fields, version or snapshot', () => {
    const parsed = templateCreateSchema.parse({
      ...templateFixture(),
      version: 99,
      durationDays: 99,
      estimatedTotalVnd: 1,
      sourceSnapshot: { storySlug: 'forged' },
    });
    expect(parsed).not.toHaveProperty('version');
    expect(parsed).not.toHaveProperty('durationDays');
    expect(parsed).not.toHaveProperty('estimatedTotalVnd');
    expect(parsed).not.toHaveProperty('sourceSnapshot');
  });

  it('requires an activity id list on reorder and rejects an empty one', () => {
    expect(reorderActivitiesSchema.safeParse({ day: 1, activityIds: [] }).success).toBe(
      false,
    );
    expect(
      reorderActivitiesSchema.parse({ day: 1, activityIds: ['act_2', 'act_1'] }),
    ).toEqual({ day: 1, activityIds: ['act_2', 'act_1'] });
  });

  it('rejects a story with no content blocks', () => {
    expect(storyCreateSchema.safeParse({ ...storyFixture(), content: [] }).success).toBe(
      false,
    );
  });

  it('requires alt text in both locales on an image block', () => {
    const result = storyCreateSchema.safeParse({
      ...storyFixture(),
      content: [
        { type: 'image', src: '/images/covers/da-lat.svg', alt: { vi: 'Hồ' }, caption: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an h1 inside body content — the page owns the only h1', () => {
    const result = storyCreateSchema.safeParse({
      ...storyFixture(),
      content: [{ type: 'heading', level: 1, text: { vi: 'Tiêu đề', en: 'Title' } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a 24-hour time that is not a real clock time', () => {
    const base = templateFixture();
    const day = base.days[0];
    expect(day).toBeDefined();
    const activity = day?.activities[0];
    expect(activity).toBeDefined();
    const result = templateCreateSchema.safeParse({
      ...base,
      days: [
        {
          ...day,
          activities: [{ ...activity, startTime: '25:00' }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
