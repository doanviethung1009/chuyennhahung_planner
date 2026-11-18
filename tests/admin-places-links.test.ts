import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}));
vi.mock('../src/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: { pathname: string; params: { slug: string } }; children: ReactNode }) =>
    createElement('a', { href: href.pathname.replace('[slug]', href.params.slug), ...rest }, children),
}));

import { PlaceSiteLink } from '../src/components/admin/community/place-link';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('admin places site link', () => {
  const html = renderToStaticMarkup(createElement(PlaceSiteLink, { slug: 'hue-imperial' }));

  it('links to the public place page in a new tab with a safe rel', () => {
    expect(html).toContain('href="/places/hue-imperial"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('href="#"');
  });

  it('announces the new tab and keeps a 44px target', () => {
    expect(html).toContain('viewOnSite');
    expect(html).toMatch(/sr-only[^>]*> newTab/);
    expect(html).toContain('min-h-11');
  });

  it('is wired into the places list and editor only, with no extra request', () => {
    const list = read('src/components/admin/content/content-list.tsx');
    const shell = read('src/components/admin/content/record-shell.tsx');
    expect(list).toContain("kind === 'places' ? <PlaceSiteLink");
    expect(shell).toContain("back === 'places'");
    expect(list.match(/api</g)?.length).toBe(1);
    expect(list.match(/api\(/g)?.length).toBe(1);
  });

  it('has VI and EN strings', () => {
    for (const f of ['messages/vi.json', 'messages/en.json']) {
      const places = JSON.parse(read(f)).adminContent.places;
      expect(places.viewOnSite).toBeTruthy();
      expect(places.newTab).toBeTruthy();
    }
  });
});
