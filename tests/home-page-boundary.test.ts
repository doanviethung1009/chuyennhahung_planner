import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig, { homePaths, mapSharePaths, memberMapPaths, sessionCookieName } from '../next.config';
import { SESSION_COOKIE } from '../src/server/planner/auth';

/**
 * ADR 0022 lets the home page — and only it — read the session cookie on the
 * server. These checks keep that one exception from spreading, and keep the
 * public SEO surface of `/` free of request data.
 */

const src = resolve(import.meta.dirname, '../src');
const read = (path: string) => readFileSync(resolve(src, path), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

const home = read('app/[locale]/page.tsx');

describe('home page request-data boundary (ADR 0022)', () => {
  it('reads the member through the one dedicated module', () => {
    expect(home).toMatch(/readHomeMember\(\)/);
    expect(home).not.toMatch(/from ['"]next\/headers['"]/);
    expect(home).not.toMatch(/\b(cookies|headers|draftMode)\s*\(/);
  });

  it('keeps generateMetadata free of request data', () => {
    const start = home.indexOf('export async function generateMetadata');
    const end = home.indexOf('export default async function HomePage');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const metadata = home.slice(start, end);
    expect(metadata).not.toMatch(/readHomeMember|cookies|headers\s*\(/);
  });

  it('is imported by no other page, layout, component or library file', () => {
    // Everything under src may import it only as the page does, plus the
    // band's type-only import. Walking all of src closes the gap a component
    // or lib file would otherwise leave.
    const importers = walk(src)
      .filter((path) => /server\/planner\/home-page['"]/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(src, path).split(sep).join('/'))
      .filter((path) => path !== 'server/planner/home-page.ts');
    expect(importers.sort()).toEqual(['app/[locale]/page.tsx', 'components/home/home-member-band.tsx']);
  });

  it('lets the band import it as a type only', () => {
    expect(read('components/home/home-member-band.tsx')).toMatch(
      /^import type \{ HomeMember \} from '@\/server\/planner\/home-page';/m,
    );
  });

  it('keeps request APIs out of every component and library file', () => {
    const offenders = [...walk(join(src, 'components')), ...walk(join(src, 'lib'))]
      .filter((path) => /from ['"]next\/headers['"]/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(src, path).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });

  it('keeps the cache-header cookie name equal to the real session cookie', () => {
    expect(sessionCookieName).toBe(SESSION_COOKIE);
  });

  it('answers a cookie request on the home page private, no-store (A-9)', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    for (const source of homePaths) {
      const rule = rules.filter((r) => r.source === source && r.has).at(-1);
      expect(rule, source).toEqual({
        source,
        has: [{ type: 'cookie', key: SESSION_COOKIE }],
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      });
    }
  });

  it('adds no cache rule that would reach guests or other pages', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    // The member map (ADR 0029) is private for every request; the home page only with the cookie.
    // The shared member map (ADR 0030) is a third, deliberate, cookie-free no-store rule.
    const cacheRules = rules.filter((r) => r.headers.some((h) => h.key.toLowerCase() === 'cache-control'));
    expect(cacheRules.map((r) => r.source).sort()).toEqual(
      [...homePaths, ...memberMapPaths, ...mapSharePaths].sort(),
    );
    for (const rule of cacheRules.filter((r) => homePaths.includes(r.source))) expect(rule.has?.length).toBe(1);
  });

  it('is not used by the shared chrome', () => {
    for (const path of [
      'app/[locale]/layout.tsx',
      'components/layout/site-header.tsx',
      'components/layout/main-nav.tsx',
      'components/layout/account-menu.tsx',
      'components/layout/site-footer.tsx',
    ]) {
      expect(read(path), path).not.toMatch(/home-page|readHomeMember/);
    }
  });

  it('passes the band only the allow-listed member value', () => {
    const band = read('components/home/home-member-band.tsx');
    expect(band).not.toMatch(/dangerouslySetInnerHTML/);
    expect(band).not.toMatch(/shareToken|ownerId|\.note\b|\.budget\b|\.version\b/);
    expect(band).not.toMatch(/^['"]use client['"]/m);
  });
});
