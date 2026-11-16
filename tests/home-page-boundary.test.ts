import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('is imported by no other page or layout', () => {
    const offenders = walk(join(src, 'app'))
      .filter((path) => relative(src, path) !== join('app', '[locale]', 'page.tsx'))
      .filter((path) => /server\/planner\/home-page/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(src, path).split(sep).join('/'));
    expect(offenders).toEqual([]);
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
