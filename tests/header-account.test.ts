import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The header account control (docs/features/header-account.md).
 *
 * The signed-in state is read in the browser, after load, from
 * `GET /api/planner/session`. Reading the session cookie on the server in the
 * shared chrome would make every page dynamic, so the layout and the header
 * must never touch request data.
 */

const src = resolve(import.meta.dirname, '../src');
const read = (path: string) => readFileSync(resolve(src, path), 'utf8');

const chrome = [
  'app/[locale]/layout.tsx',
  'components/layout/site-header.tsx',
  'components/layout/main-nav.tsx',
  'components/layout/account-menu.tsx',
];

describe('header account control', () => {
  it.each(chrome)('%s reads no request data, so pages stay static', (path) => {
    const source = read(path);
    expect(source).not.toMatch(/from ['"]next\/headers['"]/);
    expect(source).not.toMatch(/\b(cookies|headers|draftMode)\s*\(/);
    expect(source).not.toMatch(/@\/server\//);
  });

  it('asks the session endpoint, and signs out with DELETE on the same origin', () => {
    const source = read('components/layout/account-menu.tsx');
    expect(source).toMatch(/^'use client';/);
    expect(source.match(/fetch\('\/api\/planner\/session'/g)?.length).toBe(2);
    expect(source).toMatch(/method: 'DELETE'/);
    expect(source.match(/credentials: 'same-origin'/g)?.length).toBe(2);
  });

  it('shows the admin entry only to the admin role', () => {
    const source = read('components/layout/account-menu.tsx');
    expect(source).toMatch(/user\.role === 'admin' \?[\s\S]{0,120}href="\/admin"/);
  });

  it('is mounted on desktop and in the mobile drawer', () => {
    const source = read('components/layout/main-nav.tsx');
    expect(source).toMatch(/<AccountMenu state=\{account\} \/>/);
    expect(source).toMatch(/<AccountDrawerSection state=\{account\}/);
  });

  it('has no placeholder links', () => {
    expect(read('components/layout/account-menu.tsx')).not.toMatch(/href=["']#/);
  });
});
