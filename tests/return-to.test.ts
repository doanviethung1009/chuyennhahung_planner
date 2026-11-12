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

  it('accepts public pages, so the header sign-in link returns the reader to them', () => {
    for (const ok of [
      '/',
      '/en',
      '/en/',
      '/chuyen-di-choi',
      '/en/stories',
      '/chuyen-di-choi/mot-cau-chuyen',
      '/kham-pha/da-lat',
      '/goc-review',
      '/en/about',
      '/thiet-ke-chuyen-di',
    ]) {
      expect(safeReturnTo(ok), ok).toBe(ok);
    }
  });

  it('rejects unknown paths and routes that are not returnable', () => {
    for (const bad of [
      '/admin/x',
      '/dang-nhap',
      '/en/sign-in',
      '/chia-se/abc',
      '/en/shared/abc',
      '/khong-co-trang-nay',
      '/en/x',
      '/my-trips/a/b',
    ]) {
      expect(safeReturnTo(bad), bad).toBe('/my-trips');
    }
  });

  it('handles null and undefined', () => {
    expect(safeReturnTo(null)).toBe('/my-trips');
    expect(safeReturnTo(undefined)).toBe('/my-trips');
  });
});
