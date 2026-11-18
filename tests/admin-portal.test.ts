import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import nextConfig, { adminPaths } from '../next.config';
import robots from '../src/app/robots';
import { pathnames } from '../src/i18n/routing';
import { safeReturnTo } from '../src/lib/return-to';
import { adminSidebarGroups } from '../src/lib/admin-gate';
// `adminSidebarGroups` is pure; the gate's server-only imports are stubbed out.
vi.mock('../src/i18n/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../src/server/planner/admin-page', () => ({ readStaffPageAccess: vi.fn() }));

import type { Role } from '../src/server/identity/permissions';

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

  it('routes the moved user console at /quan-tri/nguoi-dung and /en/admin/users (ADR 0020)', () => {
    expect(pathnames['/admin/users']).toEqual({ vi: '/quan-tri/nguoi-dung', en: '/admin/users' });
    for (const ok of ['/quan-tri/nguoi-dung', '/en/admin/users', '/en/admin/users?x=1']) {
      expect(safeReturnTo(ok), ok).toBe(ok);
    }
    expect(safeReturnTo('/quan-tri/nguoi-dung/x')).toBe('/my-trips');
    expect(safeReturnTo('/quan-tri/nguoi-dungx')).toBe('/my-trips');
    expect(safeReturnTo('/en/admin/userss')).toBe('/my-trips');
  });

  it('gives every admin page one frame: a layout, and no page draws its own nav', () => {
    const base = resolve(import.meta.dirname, '../src/app/(admin)/[locale]/admin');
    expect(readFileSync(join(base, 'layout.tsx'), 'utf8')).toMatch(/AdminSidebar/);
    expect(readFileSync(join(base, 'users/page.tsx'), 'utf8')).toMatch(/requireStaff\([\s\S]*?'users'\)/);
    expect(readFileSync(join(base, 'page.tsx'), 'utf8')).not.toMatch(/AdminConsole|AdminNav/);
  });
});

describe('admin page gates (ADR 0020)', () => {
  it('has every admin page call requireStaff itself, whatever the layout draws', () => {
    const base = resolve(import.meta.dirname, '../src/app/(admin)/[locale]/admin');
    const pages = (readdirSync(base, { recursive: true, withFileTypes: true }) as Dirent[])
      .filter((entry) => entry.isFile() && entry.name === 'page.tsx')
      // The `[...rest]` catch-all only calls notFound(); it reads no session.
      .filter((entry) => !entry.parentPath.includes('[...rest]'))
      .map((entry) => join(entry.parentPath, entry.name));
    expect(pages.length).toBeGreaterThanOrEqual(9);
    for (const file of pages) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/requireStaff\(/);
    }
  });
});

describe('admin sidebar visibility (ADR 0020 §2)', () => {
  const hrefs = (role: Role | 'service') =>
    adminSidebarGroups({ role }).flatMap((group) => group.links.map((link) => link.href));

  it('shows an editor Overview, Content and Community — never People or Operations', () => {
    const links = hrefs('editor');
    expect(links).toEqual([
      '/admin',
      '/admin/content/stories',
      '/admin/content/places',
      '/admin/content/reviews',
      '/admin/content/collections',
      '/admin/content/integrity',
      '/admin/community',
    ]);
    expect(adminSidebarGroups({ role: 'editor' }).map((group) => group.id)).not.toContain('people');
  });

  it('adds People for an admin and Operations (Runbook) for a super admin only', () => {
    expect(hrefs('admin')).toContain('/admin/users');
    expect(hrefs('admin')).not.toContain('/admin/runbook');
    expect(hrefs('super_admin')).toEqual(expect.arrayContaining(['/admin/users', '/admin/runbook']));
  });

  it('shows the audit log to admins and super admins, never to an editor', () => {
    expect(hrefs('editor')).not.toContain('/admin/audit');
    expect(hrefs('admin')).toContain('/admin/audit');
    expect(hrefs('super_admin')).toContain('/admin/audit');
  });

  it('drops a group with no visible link and renders no Media group yet', () => {
    expect(adminSidebarGroups({ role: 'member' }).map((group) => group.id)).toEqual(['overview']);
    for (const role of ['editor', 'admin', 'super_admin'] as const) {
      expect(adminSidebarGroups({ role }).map((group) => group.id as string)).not.toContain('media');
    }
  });
});
