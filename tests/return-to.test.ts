import { describe, expect, it } from 'vitest';
import { safeReturnTo, signInLinkFor } from '../src/lib/return-to';

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

  it('drops the query and fragment of a public page, keeps those of a private one', () => {
    expect(safeReturnTo('/chuyen-di-choi?utm_source=x&email=a@b.c')).toBe('/chuyen-di-choi');
    expect(safeReturnTo('/en/stories#comments')).toBe('/en/stories');
    expect(safeReturnTo('/?q=1')).toBe('/');
    expect(safeReturnTo('/tao-chuyen-di/da-lat-3-ngay-lang-man?x=1')).toBe('/tao-chuyen-di/da-lat-3-ngay-lang-man?x=1');
    expect(safeReturnTo('/chuyen-di-cua-toi?status=archived')).toBe('/chuyen-di-cua-toi?status=archived');
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

describe('signInLinkFor (header sign-in link)', () => {
  it('returns to the page being read', () => {
    expect(signInLinkFor('/dang-nhap', '/chuyen-di-cua-toi?tab=archived')).toBe(
      '/dang-nhap?returnTo=%2Fchuyen-di-cua-toi%3Ftab%3Darchived',
    );
  });

  it('does not nest a returnTo on the sign-in page itself', () => {
    expect(signInLinkFor('/dang-nhap', '/dang-nhap?returnTo=%2Fchuyen-di-cua-toi')).toBe(
      '/dang-nhap?returnTo=%2Fchuyen-di-cua-toi',
    );
    expect(signInLinkFor('/en/sign-in', '/en/sign-in')).toBe('/en/sign-in');
  });
});
