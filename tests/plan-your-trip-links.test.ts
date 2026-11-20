import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pathnames } from '../src/i18n/routing';
import vi from '../messages/vi.json';
import en from '../messages/en.json';

const keys = [
  'startTitle',
  'startLead',
  'startTemplatesCta',
  'startTemplatesHint',
  'startBlankCta',
  'startBlankHint',
] as const;

describe('/plan-your-trip Planner entry points', () => {
  it('links to targets that exist in the pathname map', () => {
    for (const target of ['/trip-templates', '/my-trips/new']) {
      expect(pathnames, target).toHaveProperty([target]);
    }
  });

  it('renders both targets as ButtonLink hrefs on the page', () => {
    const page = readFileSync('src/app/[locale]/plan-your-trip/page.tsx', 'utf8');
    expect(page).toContain('href="/trip-templates"');
    expect(page).toContain('href="/my-trips/new"');
    expect(page).not.toContain('href="#"');
  });

  it('has the new copy in both catalogues', () => {
    for (const catalogue of [vi, en]) {
      for (const key of keys) {
        expect(catalogue.plan[key], key).toBeTruthy();
      }
    }
  });
});
