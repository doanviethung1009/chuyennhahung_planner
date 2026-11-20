import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { pathnames } from '../src/i18n/routing';
import { listPublicTemplates, toPublicTemplateCard } from '../src/server/content/public-templates';
import type { TravelContentRepository } from '../src/server/content/repository';
import { makeRepository, storyFixture, templateFixture } from './travel-content-helpers';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

const getRepositoryMock = vi.hoisted(() => vi.fn());
vi.mock('../src/server/content/instance', () => ({ getRepository: getRepositoryMock }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => undefined,
}));

async function seeded() {
  const repo = makeRepository();
  await repo.createStory(storyFixture({ plannerTemplateSlug: 'test-template' }));
  await repo.setStoryStatus('test-story', { action: 'publish' });
  await repo.createTemplate(templateFixture({ slug: 'test-template', visibility: 'public' }));
  await repo.createTemplate(templateFixture({ slug: 'private-template', visibility: 'private' }));
  return repo;
}

describe('/trip-templates routing', () => {
  it('maps to /lich-trinh-mau (vi) and /trip-templates (en)', () => {
    expect(pathnames['/trip-templates']).toEqual({ vi: '/lich-trinh-mau', en: '/trip-templates' });
  });
});

describe('listPublicTemplates', () => {
  it('returns public templates only', async () => {
    const list = await listPublicTemplates(await seeded());
    expect(list.map((card) => card.slug)).toEqual(['test-template']);
  });

  it('drops a template as soon as it goes back to private', async () => {
    const repo = await seeded();
    await repo.updateTemplate('test-template', { visibility: 'private' });
    expect(await listPublicTemplates(repo)).toEqual([]);
  });

  it('lets a store failure reject instead of reading as an empty list', async () => {
    const broken = { listTemplates: vi.fn().mockRejectedValue(new Error('store down')) } as unknown as TravelContentRepository;
    await expect(listPublicTemplates(broken)).rejects.toThrow('store down');
  });
});

describe('PublicTemplateCard allow-list', () => {
  it('has exactly the agreed keys and leaks no internal field', async () => {
    const [card] = await listPublicTemplates(await seeded());
    expect(Object.keys(card!).sort()).toEqual(
      ['destinationSlug', 'durationDays', 'estimatedTotalVnd', 'groupSize', 'pace', 'slug', 'summary', 'title', 'travelStyle'].sort(),
    );
    const json = JSON.stringify(card);
    for (const leak of ['sourceStorySlug', 'sourceSnapshot', 'version', 'updatedAt', 'affiliate', 'days', 'visibility', 'placeSlugs', 'itinerarySlugs']) {
      expect(json).not.toContain(leak);
    }
  });

  it('does not carry a field added to the template later', async () => {
    const [template] = await (await seeded()).listTemplates({ visibility: 'public' });
    const card = toPublicTemplateCard({ ...template!, internalNote: 'x' } as typeof template & { internalNote: string });
    expect(JSON.stringify(card)).not.toContain('internalNote');
  });
});

describe('wiring', () => {
  it('is in the sitemap', () => {
    expect(readFileSync('src/app/sitemap.ts', 'utf8')).toContain("entry('/trip-templates'");
  });
  it('is linked from the footer', () => {
    expect(readFileSync('src/components/layout/site-footer.tsx', 'utf8')).toContain("href: '/trip-templates'");
  });
  it('is the target of the template button on /plan-your-trip', () => {
    expect(readFileSync('src/app/[locale]/plan-your-trip/page.tsx', 'utf8')).toContain('<ButtonLink href="/trip-templates"');
  });
  it('has the same message keys in vi and en', () => {
    expect(Object.keys(vi_.tripTemplates).sort()).toEqual(Object.keys(en_.tripTemplates).sort());
    expect(vi_.nav.tripTemplates).toBeTruthy();
    expect(en_.nav.tripTemplates).toBeTruthy();
  });
});

describe('page metadata', () => {
  const run = async () => {
    const mod = await import('../src/app/[locale]/trip-templates/page');
    return (await mod.generateMetadata({ params: Promise.resolve({ locale: 'vi' }) })).robots;
  };

  it('is noindex when the list is empty or the store fails, indexable when filled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getRepositoryMock.mockResolvedValue(makeRepository());
    expect(await run()).toEqual({ index: false, follow: true });

    getRepositoryMock.mockResolvedValue(await seeded());
    expect(await run()).not.toEqual({ index: false, follow: true });

    getRepositoryMock.mockRejectedValue(new Error('down'));
    expect(await run()).toEqual({ index: false, follow: true });
  });
});
