import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import vi_messages from '../messages/vi.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    (vi_messages as unknown as Record<string, Record<string, string>>)[namespace]?.[key] ?? `${namespace}.${key}`,
}));
vi.mock('@/i18n/navigation', () => ({
  getPathname: ({ href }: { href: string }) => href,
  Link: ({ href, className, children }: { href: { pathname: string; params: Record<string, string> } | string; className?: string; children: React.ReactNode }) => (
    <a className={className} href={typeof href === 'string' ? href : href.pathname.replace(/\[(\w+)\]/g, (_m, k: string) => href.params[k] ?? '')}>
      {children}
    </a>
  ),
}));

const { MemberMapSharePreview } = await import('../src/components/map/member-map-share-preview');

async function render(points: { slug: string; visitsBucket: 1 | 2 | 3 }[]) {
  return renderToStaticMarkup(await MemberMapSharePreview({ points, locale: 'vi' }));
}

describe('MemberMapSharePreview', () => {
  it('draws only the visited points it is given, with the bucket in words and an anonymous name', async () => {
    const html = await render([
      { slug: 'da-lat', visitsBucket: 1 },
      { slug: 'hue', visitsBucket: 3 },
    ]);
    expect(html).toContain('/destinations/da-lat');
    expect(html).toContain('/destinations/hue');
    expect(html).not.toContain('/destinations/moc-chau');
    expect(html).toContain(vi_messages.sharedMap.bucket1);
    expect(html).toContain(vi_messages.sharedMap.bucket3);
    expect(html).toContain(vi_messages.memberMapShare.previewNameAnonymous);
    expect(html).not.toContain(vi_messages.memberMapShare.sparseWarning);
    // Not a hollow "planned" pin, no date, no review wording.
    expect(html).not.toContain(vi_messages.memberMap.planned);
  });

  it('warns under 2 visited places, and says it is empty with none', async () => {
    expect(await render([{ slug: 'da-lat', visitsBucket: 1 }])).toContain(vi_messages.memberMapShare.sparseWarning);
    const empty = await render([]);
    expect(empty).toContain(vi_messages.memberMapShare.sparseWarning);
    expect(empty).toContain(vi_messages.memberMapShare.previewEmpty);
  });

  it('drops a slug the catalogue does not know and has one h3 heading, no h1/h2', async () => {
    const html = await render([{ slug: 'khong-co', visitsBucket: 1 }]);
    expect(html).not.toContain('khong-co');
    expect(html).toContain('<h3');
    expect(html).not.toMatch(/<h[12]/);
  });
});
