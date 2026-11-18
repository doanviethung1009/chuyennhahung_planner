import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify } from '../src/lib/slug';
import { publicContentPath } from '../src/lib/public-path';
import { slugSchema } from '../src/server/content/schemas';

describe('slugify', () => {
  it('handles real Vietnamese titles', () => {
    expect(slugify('Chợ đêm Đà Lạt')).toBe('cho-dem-da-lat');
    expect(slugify('Phố cổ Hội An')).toBe('pho-co-hoi-an');
    expect(slugify('Bánh mì Sài Gòn')).toBe('banh-mi-sai-gon');
  });
  it('maps đ and Đ by hand', () => {
    expect(slugify('đường Điện Biên')).toBe('duong-dien-bien');
  });
  it('strips every tone mark', () => {
    expect(slugify('àáảãạ ăằắẳẵặ âầấẩẫậ èéẻẽẹ êềếểễệ ìíỉĩị òóỏõọ ôồốổỗộ ơờớởỡợ ùúủũụ ưừứửữự ỳýỷỹỵ')).toBe('aaaaa-aaaaaa-aaaaaa-eeeee-eeeeee-iiiii-ooooo-oooooo-oooooo-uuuuu-uuuuuu-yyyyy');
  });
  it('collapses spaces and special characters', () => {
    expect(slugify('  Hello,   World!! (2026) / x  ')).toBe('hello-world-2026-x');
    expect(slugify('---a--b---')).toBe('a-b');
  });
  it('returns empty for accent-only, symbol-only or too short input', () => {
    expect(slugify('́̀̉')).toBe('');
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('')).toBe('');
    expect(slugify('Hà')).toBe('');
    expect(slugify('Đà Nẵng')).toBe('da-nang');
  });
  it('cuts to 96 characters at a word boundary', () => {
    const slug = slugify('đi '.repeat(60) + 'cuoi');
    expect(slug.length).toBeLessThanOrEqual(96);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(/^(di-)*di$/);
    expect(slugify('a'.repeat(200))).toBe('a'.repeat(96));
  });
  it('is idempotent and always accepted by slugSchema', () => {
    const inputs = ['Chợ đêm Đà Lạt', 'Tết 2026 – Huế!', 'x'.repeat(150), 'ABC def  ghi', 'Quán Ăn Ngon Số 1 ' + 'a '.repeat(80)];
    for (const input of inputs) {
      const slug = slugify(input);
      expect(slugify(slug)).toBe(slug);
      if (slug !== '') {
        expect(slugSchema.safeParse(slug).success).toBe(true);
        expect(isValidSlug(slug)).toBe(true);
      }
    }
  });
});

describe('isValidSlug agrees with slugSchema', () => {
  it.each(['abc', 'a-b-c', 'ab', '-ab', 'ab-', 'a--b', 'Abc', 'a_b', 'x'.repeat(96), 'x'.repeat(97), 'new'])('%s', (value) => {
    expect(isValidSlug(value)).toBe(slugSchema.safeParse(value).success);
  });
});

describe('publicContentPath', () => {
  it('builds VI unprefixed and EN prefixed paths from the routing map', () => {
    expect(publicContentPath('stories', 'da-lat', 'vi')).toBe('/chuyen-di-choi/da-lat');
    expect(publicContentPath('stories', 'da-lat', 'en')).toBe('/en/stories/da-lat');
    expect(publicContentPath('places', 'cho-dem', 'vi')).toBe('/dia-diem/cho-dem');
    expect(publicContentPath('places', 'cho-dem', 'en')).toBe('/en/places/cho-dem');
  });
});
