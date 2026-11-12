import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '../src/lib/return-to';

describe('safeReturnTo (open-redirect guard)', () => {
  it('accepts known private routes in both locales', () => {
    for (const ok of [
      '/my-trips',
      '/chuyen-di-cua-toi',
      '/en/my-trips',
      '/my-trips/trip_abc123',
      '/chuyen-di-cua-toi/trip_abc123',
      '/tao-chuyen-di/da-lat-3-ngay-lang-man',
      '/en/trip-setup/da-lat-3-ngay-lang-man',
      '/tao-chuyen-di/da-lat-3-ngay-lang-man?x=1',
      '/quan-tri',
      '/en/admin',
    ]) {
      expect(safeReturnTo(ok), ok).toBe(ok);
    }
  });

  it('rejects protocol-relative, absolute, backslash and scheme values', () => {
    for (const bad of [
      '//evil.com',
      '///evil.com',
      'https://evil.com',
      'http://evil.com/my-trips',
      '/\\evil.com',
      '/my-trips\\..\\x',
      'javascript:alert(1)',
      '/javascript:alert(1)',
      '/my-trips\n//evil.com',
      'my-trips',
      '',
    ]) {
      expect(safeReturnTo(bad), bad).toBe('/my-trips');
    }
  });

  it('rejects unknown paths and routes that are not returnable', () => {
    for (const bad of ['/admin/x', '/dang-nhap', '/chia-se/abc', '/stories', '/my-trips/a/b']) {
      expect(safeReturnTo(bad), bad).toBe('/my-trips');
    }
  });

  it('handles null and undefined', () => {
    expect(safeReturnTo(null)).toBe('/my-trips');
    expect(safeReturnTo(undefined)).toBe('/my-trips');
  });

  it('returns to the admin content screens, in both locales', () => {
    for (const path of [
      '/quan-tri/noi-dung/chuyen-di',
      '/quan-tri/noi-dung/chuyen-di/da-lat-2-ngay',
      '/en/admin/content/places',
      '/en/admin/content/reviews',
    ]) {
      expect(safeReturnTo(path)).toBe(path);
    }
  });
});
