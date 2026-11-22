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

  it('shows the admin entry to every staff role, never to a member', () => {
    const source = read('components/layout/account-menu.tsx');
    expect(source).toMatch(/user\.role !== 'member' \?[\s\S]{0,120}href="\/admin"/);
  });

  it('is mounted on desktop and in the mobile drawer', () => {
    const source = read('components/layout/main-nav.tsx');
    expect(source).toMatch(/<AccountMenu state=\{account\} \/>/);
    expect(source).toMatch(/<AccountDrawerSection state=\{account\}/);
  });

  it('has no placeholder links', () => {
    expect(read('components/layout/account-menu.tsx')).not.toMatch(/href=["']#/);
  });

  it('holds the 44px account slot while the session loads (no layout shift)', () => {
    const source = read('components/layout/account-menu.tsx');
    expect(source).toMatch(/status === 'loading'\) \{\s*return <span[^>]*size-11/);
  });
});

describe('mobile drawer focus management', () => {
  const source = read('components/layout/main-nav.tsx');

  it('moves focus into the dialog and makes the page behind inert', () => {
    expect(source).toMatch(/panelRef\.current\?\.focus\(\)/);
    expect(source).toMatch(/setAttribute\('inert', ''\)/);
    expect(source).toMatch(/removeAttribute\('inert'\)/);
  });

  it('keeps the toggle in the focus loop', () => {
    expect(source).toMatch(/toggleRef\.current \? \[toggleRef\.current\]/);
  });

  it('closes when the viewport grows to the desktop layout', () => {
    expect(source).toMatch(/matchMedia\('\(min-width: 80rem\)'\)/);
  });

  it('switches between the inline row and the drawer at one breakpoint (xl)', () => {
    expect(source).not.toMatch(/\blg:/);
    expect(source).toMatch(/hidden items-center[^"]*xl:flex/);
    expect(source).toMatch(/xl:hidden/);
  });

  it('keeps the inline row on one line and omits Home (the logo goes there)', () => {
    expect(source).toMatch(/item\.key !== 'home'/);
    expect(source).toMatch(/whitespace-nowrap/);
  });

  it('labels the drawer nav landmark', () => {
    expect(source).toMatch(/<nav aria-label=\{navLabel\} className="flex flex-col/);
  });
});

describe('header navigation (UXS-2)', () => {
  const main = read('components/layout/main-nav.tsx');
  const header = read('components/layout/site-header.tsx');
  const account = read('components/layout/account-menu.tsx');
  const footer = read('components/layout/site-footer.tsx');

  it('picks the CTA by session: guests the planner page, members the new-trip page', () => {
    expect(main).toMatch(/signedIn \? memberCta : guestCta/);
    expect(header).toMatch(/guestCta=\{\{ href: '\/plan-your-trip'/);
    expect(header).toMatch(/memberCta=\{\{ href: '\/my-trips\/new'/);
  });

  it('holds the CTA slot, hidden, while the session loads (no label flash)', () => {
    expect(main).toMatch(/account\.status === 'loading'[\s\S]{0,80}'aria-hidden': true, tabIndex: -1/);
    expect(main).toMatch(/invisible \[@media\(scripting:none\)\]:visible/);
  });

  it('shows the sign-in word from 2xl and the icon below', () => {
    expect(account).toMatch(/hidden whitespace-nowrap 2xl:inline/);
    expect(account).toMatch(/aria-label=\{t\('signIn'\)\}/);
  });

  it('discloses groups as buttons with aria-expanded, closing on Escape', () => {
    expect(main).toMatch(/aria-expanded=\{open\}[\s\S]{0,80}aria-controls=\{panelId\}/);
    expect(main).toMatch(/event\.key === 'Escape' && open/);
  });

  it('has no text under 12px in the header or footer (UXA-16)', () => {
    for (const source of [header, main, account, footer]) expect(source).not.toMatch(/text-\[(?:0\.[0-6]\d*|0\.7[0-4]\d*)rem\]|text-\[(?:\d|1[01])px\]/);
  });

  it('keeps the footer to one theme per column and no sign-in surprise for guests', () => {
    expect(footer).toMatch(/heading: 'exploreHeading'/);
    expect(footer).toMatch(/heading: 'planHeading'/);
    expect(footer).toMatch(/heading: 'aboutHeading'/);
    expect(footer).not.toMatch(/href: '\/my-trips'/);
    for (const href of ['/places', '/trip-templates', '/map']) expect(footer).toContain(`href: '${href}'`);
  });
});
