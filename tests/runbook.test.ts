import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { pathnames } from '../src/i18n/routing';
import { RUNBOOK_DOCS, isRunbookDoc } from '../src/server/runbook/docs';

// The renderer links through next-intl's navigation, which needs a request.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: { query: { doc: string } }; children: unknown }) =>
    createElement('a', { href: `/admin/runbook?doc=${href.query.doc}` }, children as never),
}));

const root = resolve(import.meta.dirname, '..');
const apiDir = join(root, 'src/app/api');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

const METHOD = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

function actualEndpoints(): string[] {
  return routeFiles(apiDir)
    .flatMap((file) => {
      const path = '/api/' + relative(apiDir, file).replace(/\/?route\.ts$/, '');
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(METHOD)].map((m) => `${m[1]} ${path}`);
    })
    .sort();
}

function documentedEndpoints(file: string): string[] {
  return readFileSync(join(root, 'docs', file), 'utf8')
    .split('\n')
    .flatMap((line) => {
      const m = /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`(\/api\/[^`]+)`/.exec(line);
      return m ? [`${m[1]} ${m[2]}`] : [];
    })
    .sort();
}

describe('runbook API list (docs/runbook.md)', () => {
  const actual = actualEndpoints();

  it.each(['runbook.md', 'runbook.vi.md'])('%s lists exactly the route handlers on disk', (file) => {
    const documented = documentedEndpoints(file);
    expect(actual.filter((e) => !documented.includes(e))).toEqual([]);
    expect(documented.filter((e) => !actual.includes(e))).toEqual([]);
    expect(new Set(documented).size).toBe(documented.length);
  });
});

describe('admin runbook tab', () => {
  it('is routed at /quan-tri/runbook and /en/admin/runbook', () => {
    expect(pathnames['/admin/runbook']).toEqual({ vi: '/quan-tri/runbook', en: '/admin/runbook' });
  });

  it('only ever serves an allow-listed document that exists in both languages', () => {
    for (const id of RUNBOOK_DOCS) {
      expect(existsSync(join(root, 'docs', `${id}.md`))).toBe(true);
      expect(existsSync(join(root, 'docs', `${id}.vi.md`))).toBe(true);
    }
    for (const bad of ['../package', '..%2Fpackage', 'runbook.md', 'adr/0001', '', undefined, 'README']) {
      expect(isRunbookDoc(bad)).toBe(false);
    }
  });

  it('is gated to users:provision (admin) and hides the nav link from other roles', () => {
    const page = readFileSync(join(root, 'src/app/[locale]/admin/runbook/page.tsx'), 'utf8');
    expect(page).toMatch(/requireStaff\([\s\S]*?'users'\)/);
    const nav = readFileSync(join(root, 'src/components/admin/admin-nav.tsx'), 'utf8');
    expect(nav).toMatch(/canUsers \? \(\s*<Link href="\/admin\/runbook"/);
  });
});

describe('runbook markdown renderer', () => {
  it('renders tables, code and lists, and demotes # to h2', async () => {
    const { Markdown } = await import('../src/components/runbook/markdown');
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        tableLabel: 'tbl',
        source: '# Title\n\n| A | B |\n|---|---|\n| `x\\|y` | **bold** |\n\n- one\n- two\n\n```bash\nnpm test\n```\n',
      }),
    );
    expect(html).toContain('<h2');
    expect(html).not.toContain('<h1');
    expect(html).toContain('<table');
    expect(html).toContain('<code');
    expect(html).toContain('x|y');
    expect(html).toContain('<ul');
    expect(html).toContain('npm test');
  });

  it('never emits raw HTML or unsafe links', async () => {
    const { Markdown } = await import('../src/components/runbook/markdown');
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        tableLabel: 'tbl',
        source:
          '<script>alert(1)</script>\n\n[bad](javascript:alert(1)) [rel](../secret.md) [ext](https://example.com) [doc](runbook.vi.md#x)\n',
      }),
    );
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('secret.md');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="/admin/runbook?doc=runbook"');
  });
});
