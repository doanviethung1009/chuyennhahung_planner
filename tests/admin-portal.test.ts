import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig, { adminPaths } from '../next.config';
import robots from '../src/app/robots';
import { pathnames } from '../src/i18n/routing';
import { safeReturnTo } from '../src/lib/return-to';

const adminDir = resolve(import.meta.dirname, '../src/components/admin');

describe('admin portal (frontend, ADR 0010)', () => {
  it('is routed at /quan-tri and /en/admin', () => {
    expect(pathnames['/admin']).toEqual({ vi: '/quan-tri', en: '/admin' });
  });

  it('is a valid sign-in returnTo in both locales, and nothing near it is', () => {
    expect(safeReturnTo('/quan-tri')).toBe('/quan-tri');
    expect(safeReturnTo('/en/admin')).toBe('/en/admin');
    expect(safeReturnTo('/quan-tri/../x')).toBe('/my-trips');
    expect(safeReturnTo('//quan-tri')).toBe('/my-trips');
  });

  it('is disallowed in robots.txt and absent from the sitemap', () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0]! : rules;
    expect(rule.disallow).toEqual(['/quan-tri', '/en/admin']);
    // sitemap.ts needs the Next runtime to import, so assert on its source: it
    // lists pages explicitly and must never name the admin route.
    const source = readFileSync(resolve(import.meta.dirname, '../src/app/sitemap.ts'), 'utf8');
    expect(source).not.toMatch(/['"]\/admin['"]|quan-tri/);
  });

  it('sends X-Robots-Tag noindex, nofollow on both localized paths, and keeps the tour redirects', async () => {
    expect(adminPaths).toEqual(['/quan-tri/:path*', '/en/admin/:path*']);
    const rules = (await nextConfig.headers?.()) ?? [];
    for (const source of adminPaths) {
      const rule = rules.find((r) => r.source === source);
      expect(rule?.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
    }
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects.map((r) => r.source)).toContain('/tour/:slug');
  });

  it('matches the bare admin paths and their sub-paths with Next’s own matcher, and nothing beside them', async () => {
    const { pathToRegexp } = (await import(
      'next/dist/compiled/path-to-regexp' as string
    )) as { pathToRegexp: (path: string) => RegExp };
    const covered = (path: string) => adminPaths.some((source) => pathToRegexp(source).test(path));
    for (const path of ['/quan-tri', '/quan-tri/', '/quan-tri/x', '/en/admin', '/en/admin/x']) {
      expect(covered(path), path).toBe(true);
    }
    for (const path of ['/quan-trix', '/en/administrator', '/admin', '/']) {
      expect(covered(path), path).toBe(false);
    }
  });

  it('keeps ADMIN_API_TOKEN and server modules out of every admin client file', () => {
    const files = readdirSync(adminDir).filter((name) => /\.tsx?$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const source = readFileSync(join(adminDir, name), 'utf8');
      expect(source, name).not.toMatch(/ADMIN_API_TOKEN|process\.env/);
      expect(source, name).not.toMatch(/from\s+['"](?:@\/server|\.\.?\/.*server)/);
      expect(source, name).not.toMatch(/localStorage|sessionStorage/);
    }
  });
});
