import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Server secrets must never reach the browser (ADR 0006).
 *
 * Every module that declares `'use client'` is shipped to the browser, along
 * with everything it imports at runtime. So a client module may not:
 * - name `ADMIN_API_TOKEN` (or any secret) at all;
 * - read `process.env` except a `NEXT_PUBLIC_*` variable, which Next inlines
 *   on purpose and is public by definition;
 * - import a server module (`@/server/**`, a relative path into `src/server`,
 *   `node:*`) as a value, statically or via `import()`. A type-only
 *   import is erased at compile time and is allowed — that is how the Planner
 *   components share `Trip` and `TripView` with the backend.
 */

const root = resolve(import.meta.dirname, '../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx?|jsx?|mjs)$/.test(name) ? [path] : [];
  });
}

/** A directive must be the first statement; only comments may precede it. */
function isClientModule(source: string): boolean {
  const body = source.replace(/^(?:\s+|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '');
  return /^(['"])use client\1/.test(body);
}

const clientFiles = walk(root)
  .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
  .filter(({ source }) => isClientModule(source));

/** Import statements that survive compilation (i.e. not `import type`). */
function valueImports(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /^\s*import\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  for (const match of source.matchAll(pattern)) {
    const clause = match[1]!;
    // `import { type A, type B } from …` is erased as well.
    const named = clause.match(/^\{([\s\S]*)\}$/);
    if (named && named[1]!.split(',').every((part) => /^\s*(type\s+\w+.*)?\s*$/.test(part))) continue;
    specifiers.push(match[2]!);
  }
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specifiers.push(match[1]!);
  for (const match of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]!);
  return specifiers;
}

/** Resolves an import specifier to a path under `src/`, when it points there. */
function targetsServer(spec: string, fromFile: string): boolean {
  if (spec.startsWith('node:') || spec === 'server-only') return true;
  const target = spec.startsWith('@/')
    ? join(root, spec.slice(2))
    : spec.startsWith('.')
      ? resolve(dirname(fromFile), spec)
      : null;
  return target !== null && relative(root, target).split(sep)[0] === 'server';
}

describe('client boundary', () => {
  it('keeps pages off the content repository and store (ADR 0012)', () => {
    const offenders = walk(join(root, 'app'))
      .filter((p) => !p.includes(`${sep}api${sep}`))
      .filter((p) => valueImports(readFileSync(p, 'utf8')).some((spec) => /server\/content\/(repository|store)$/.test(spec)))
      .map((p) => relative(root, p));
    expect(offenders).toEqual([]);
  });

  it('finds the client components it is guarding', () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it.each(clientFiles.map(({ path, source }) => [relative(root, path), source, path]))(
    '%s keeps server secrets and server modules out of the browser',
    (_name, source, path) => {
      expect(source).not.toMatch(/ADMIN_API_TOKEN/);

      const envReads = [...source.matchAll(/process\.env\.?\[?['"]?(\w+)/g)].map((m) => m[1]!);
      expect(envReads.filter((name) => !name.startsWith('NEXT_PUBLIC_'))).toEqual([]);

      const serverImports = valueImports(source).filter((spec) => targetsServer(spec, path));
      expect(serverImports).toEqual([]);
    },
  );

  it('flags a value import from the server and allows a type-only one', () => {
    expect(valueImports("import { getStore } from '@/server/planner/store';")).toEqual([
      '@/server/planner/store',
    ]);
    expect(valueImports("import type { Trip } from '@/server/planner/schemas';")).toEqual([]);
    expect(valueImports("import { type Trip } from '@/server/planner/schemas';")).toEqual([]);
    expect(valueImports("const m = await import('@/server/planner/store');")).toEqual([
      '@/server/planner/store',
    ]);
  });

  it('resolves aliased and relative specifiers into src/server', () => {
    const from = join(root, 'components/planner/x.tsx');
    expect(targetsServer('@/server/planner/store', from)).toBe(true);
    expect(targetsServer('../../server/planner/store', from)).toBe(true);
    expect(targetsServer('@/lib/return-to', from)).toBe(false);
    expect(targetsServer('react', from)).toBe(false);
  });

  it('detects the directive after a long leading comment', () => {
    expect(isClientModule(`/** ${'x'.repeat(500)} */\n'use client';\n`)).toBe(true);
    expect(isClientModule("import x from 'y';\n'use client';\n")).toBe(false);
  });
});
