import { readdirSync, readFileSync, existsSync, type Dirent } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const NOT_FOUND = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
  useParams: () => ({}),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}));
vi.mock('../src/i18n/navigation', () => ({
  redirect: vi.fn(),
  usePathname: () => '/admin/content/places/hue',
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));
const access = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../src/server/planner/admin-page', () => ({ readStaffPageAccess: access.read }));

import { adminSidebarGroups, requireStaff } from '../src/lib/admin-gate';
import { AdminSidebar } from '../src/components/admin/admin-sidebar';
import { AdminPageHeader } from '../src/components/admin/admin-page-header';
import AdminUnknownAdmin from '../src/app/(admin)/[locale]/admin/[...rest]/page';
import AdminUnknownVi from '../src/app/(admin)/[locale]/quan-tri/[...rest]/page';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const adminRoot = 'src/app/(admin)/[locale]';

function files(dir: string, name: string): string[] {
  return (readdirSync(join(root, dir), { recursive: true, withFileTypes: true }) as Dirent[])
    .filter((entry) => entry.isFile() && entry.name === name)
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('admin root layout (ADR 0023)', () => {
  it('draws no public chrome', () => {
    const layout = read(`${adminRoot}/layout.tsx`);
    for (const name of ['SiteHeader', 'SiteFooter', 'AccountMenu', 'SkipLink', 'MainNav']) {
      expect(layout, name).not.toContain(name);
    }
    expect(layout).toMatch(/robots: \{ index: false, follow: false \}/);
    const frame = read(`${adminRoot}/admin/layout.tsx`);
    expect(frame).not.toMatch(/SiteHeader|SiteFooter|AccountMenu/);
  });

  it('keeps the public layout free of admin code and shares one fonts module', () => {
    const publicLayout = read('src/app/[locale]/layout.tsx');
    expect(publicLayout).not.toMatch(/components\/admin/);
    expect(publicLayout).toContain("from '../fonts'");
    expect(read(`${adminRoot}/layout.tsx`)).toContain("from '../../fonts'");
    expect(publicLayout).not.toMatch(/next\/font/);
    expect(read(`${adminRoot}/layout.tsx`)).not.toMatch(/next\/font/);
    expect(read('src/app/fonts.ts')).toMatch(/next\/font\/google/);
  });

  it('never gates on its own: the frame does not redirect or 404', () => {
    const frame = read(`${adminRoot}/admin/layout.tsx`);
    expect(frame).not.toMatch(/redirect\(|notFound\(/);
  });

  it('uses AdminPageHeader, never the public PageHeader, on every admin page', () => {
    const pages = files(`${adminRoot}/admin`, 'page.tsx').filter((f) => !f.includes('[...rest]'));
    expect(pages.length).toBe(9);
    for (const file of pages) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('<AdminPageHeader');
      expect(source, file).not.toMatch(/<PageHeader/);
      expect(source, file).not.toContain("layout/page-header");
    }
  });

  it('defines the admin bar height once', () => {
    expect(read('src/app/globals.css')).toMatch(/--admin-bar-h:\s*3\.5rem/);
  });
});

describe('one admin 404, no oracle (ADR 0023 §5)', () => {
  it('has a single admin not-found and none deeper in the tree', () => {
    expect(existsSync(join(root, `${adminRoot}/not-found.tsx`))).toBe(true);
    expect(files(adminRoot, 'not-found.tsx')).toHaveLength(1);
  });

  it('renders the same not-found for a forbidden role and for an unknown admin URL', async () => {
    access.read.mockResolvedValue({ status: 'forbidden' });
    const forbidden = await requireStaff('vi', '/quan-tri/nguoi-dung', 'users').catch((e: unknown) => e);
    const thrown = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return e;
      }
    };
    expect(forbidden).toBe(NOT_FOUND);
    expect(thrown(() => AdminUnknownAdmin())).toBe(NOT_FOUND);
    expect(thrown(() => AdminUnknownVi())).toBe(NOT_FOUND);
  });

  it('keeps the catch-alls free of session reads and data', () => {
    for (const file of [`${adminRoot}/admin/[...rest]/page.tsx`, `${adminRoot}/quan-tri/[...rest]/page.tsx`]) {
      const source = read(file);
      expect(source).not.toMatch(/requireStaff|readStaffPageAccess|cookies|server\//);
    }
  });
});

describe('AdminPageHeader', () => {
  it('renders one h1, the description and the actions slot', () => {
    const html = renderToStaticMarkup(
      createElement(AdminPageHeader, { title: 'Người dùng', description: 'Mô tả', actions: createElement('button', null, 'Thêm') }),
    );
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Người dùng');
    expect(html).toContain('Mô tả');
    expect(html).toContain('<button>Thêm</button>');
  });

  it('omits the optional parts', () => {
    const html = renderToStaticMarkup(createElement(AdminPageHeader, { title: 'T' }));
    expect(html).not.toContain('<p');
  });
});

describe('AdminSidebar', () => {
  it('marks the current page with aria-current and a non-colour cue, on detail pages too', () => {
    const groups = adminSidebarGroups({ role: 'super_admin' });
    const html = renderToStaticMarkup(createElement(AdminSidebar, { groups }));
    const current = html.match(/<a [^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(current).toHaveLength(1);
    expect(current[0]).toContain('href="/admin/content/places"');
    expect(current[0]).toMatch(/border-primary/);
    expect(current[0]).toMatch(/font-semibold/);
    expect(html).toContain('top-(--admin-bar-h)');
  });
});
