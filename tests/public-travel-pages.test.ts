import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { renderToStaticMarkup, renderToReadableStream } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TravelContentRepository } from '../src/server/content/repository';
import type { StoryBlock } from '../src/server/content/schemas';
import { makeRepository, storyFixture, bilingual, placeFixture } from './travel-content-helpers';

const holder = vi.hoisted(() => ({ repo: null as unknown }));
vi.mock('../src/server/content/instance', () => ({
  getRepository: () => Promise.resolve(holder.repo),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  setRequestLocale: () => undefined,
}));

// next-intl's navigation cannot load outside Next; a path-building stub is enough here.
vi.mock('../src/i18n/navigation', () => ({
  Link: 'a',
  getPathname: ({ href }: { href: string | { pathname: string; params?: Record<string, string> } }) =>
    typeof href === 'string'
      ? href
      : href.pathname.replace(/\[(\w+)\]/g, (_m, k: string) => href.params?.[k] ?? ''),
}));

const root = resolve(import.meta.dirname, '../src');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });

let repo: TravelContentRepository;
beforeEach(() => {
  repo = makeRepository();
  holder.repo = repo;
});
afterEach(() => vi.unstubAllEnvs());

async function publish(slug: string, extra = {}) {
  await repo.createStory(storyFixture({ slug, ...extra }));
  await repo.setStoryStatus(slug, { action: 'publish' });
}

describe('rendering mode', () => {
  const pages = [
    '[locale]/page.tsx',
    '[locale]/stories/page.tsx',
    '[locale]/stories/[slug]/page.tsx',
    '[locale]/destinations/[slug]/page.tsx',
    'sitemap.ts',
  ];
  it.each(pages)('app/%s is force-dynamic with no static params or revalidate', (rel) => {
    const src = read(`app/${rel}`);
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(src).not.toMatch(/generateStaticParams/);
    expect(src).not.toMatch(/export const revalidate/);
  });
});

describe('content source', () => {
  it('no page or component imports the typed story seed', () => {
    const offenders = [...walk(join(root, 'app')), ...walk(join(root, 'components'))].filter((p) =>
      /from ['"]@\/content\/stories['"]/.test(readFileSync(p, 'utf8')),
    );
    expect(offenders.map((p) => relative(root, p))).toEqual([]);
  });
});

describe('sitemap', () => {
  it('lists only published, indexable stories with lastModified', async () => {
    await publish('visible');
    await publish('hidden', {
      seo: { ...storyFixture().seo, noindex: true },
    });
    await repo.createStory(storyFixture({ slug: 'draft-one' }));
    const { default: sitemap } = await import('../src/app/sitemap');
    const urls = await sitemap();
    const stories = urls.filter((u) => u.url.includes('/stories/') || u.url.includes('/chuyen-di'));
    expect(stories.some((u) => u.url.endsWith('/visible'))).toBe(true);
    expect(stories.some((u) => u.url.endsWith('/hidden'))).toBe(false);
    expect(stories.some((u) => u.url.endsWith('/draft-one'))).toBe(false);
    expect(stories.find((u) => u.url.endsWith('/visible'))?.lastModified).toBeTruthy();
  });
});

describe('story page', () => {
  it('404s an unpublished slug and gives empty metadata', async () => {
    await repo.createStory(storyFixture({ slug: 'draft-one' }));
    const { default: Page, generateMetadata } = await import('../src/app/[locale]/stories/[slug]/page');
    const params = Promise.resolve({ locale: 'vi' as const, slug: 'draft-one' });
    expect(await generateMetadata({ params })).toEqual({});
    await expect(Page({ params })).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404') });
  });

  it('emits dateModified, seo image and noindex robots', async () => {
    await publish('seo-story', { seo: { ...storyFixture().seo, noindex: true } });
    const { default: Page, generateMetadata } = await import('../src/app/[locale]/stories/[slug]/page');
    const params = Promise.resolve({ locale: 'vi' as const, slug: 'seo-story' });
    expect((await generateMetadata({ params })).robots).toMatchObject({ index: false });
    const stream = await renderToReadableStream(await Page({ params }));
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain('dateModified');
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });
});

describe('block renderer', () => {
  it('renders all seven block types without an extra h1', async () => {
    await repo.createPlace(placeFixture({ slug: 'cafe-x' }));
    const blocks: StoryBlock[] = [
      { type: 'paragraph', text: bilingual('Đoạn văn', 'Para') },
      { type: 'heading', level: 2, text: bilingual('Tiêu đề hai', 'Heading two') },
      { type: 'heading', level: 3, text: bilingual('Tiêu đề ba', 'Heading three') },
      { type: 'image', src: '/images/covers/story-da-lat.svg', alt: bilingual('Hồ lúc sớm', 'Lake at dawn'), caption: null },
      { type: 'quote', text: bilingual('Trích', 'Quote'), attribution: 'Hưng' },
      { type: 'list', ordered: false, items: { vi: ['Một'], en: ['One'] } },
      { type: 'place', placeSlug: 'cafe-x', note: null },
      { type: 'cost', label: bilingual('Vé', 'Ticket'), amountVnd: 100_000 },
    ];
    const { StoryBlocks } = await import('../src/components/story/story-blocks');
    const place = await repo.getPlace('cafe-x');
    const html = renderToStaticMarkup(await StoryBlocks({ blocks, places: [place], locale: 'en' }));
    expect(html).not.toMatch(/<h1/);
    for (const needle of ['Para', '<h2', '<h3', 'alt="Lake at dawn"', '<blockquote', '<ul', 'Test place', 'Ticket']) {
      expect(html).toContain(needle);
    }
  });
});

describe('image hosts', () => {
  it('serves a non-allowlisted https image unoptimized instead of throwing', async () => {
    const { canOptimizeImage } = await import('../src/lib/image-src');
    expect(canOptimizeImage('/images/covers/x.jpg')).toBe(true);
    expect(canOptimizeImage('https://images.unsplash.com/photo-1')).toBe(true);
    expect(canOptimizeImage('https://example.org/a.jpg')).toBe(false);
    const { StoryBlocks } = await import('../src/components/story/story-blocks');
    const { CoverImage } = await import('../src/components/ui/cover-image');
    const blocks: StoryBlock[] = [
      { type: 'image', src: 'https://example.org/a.jpg', alt: bilingual('Ảnh', 'A photo'), caption: null },
    ];
    const html = renderToStaticMarkup(await StoryBlocks({ blocks, places: [], locale: 'en' }));
    expect(html).toContain('alt="A photo"');
    expect(() =>
      renderToStaticMarkup(CoverImage({ src: 'https://example.org/c.jpg', alt: '', sizes: '100vw' })),
    ).not.toThrow();
  });
});
