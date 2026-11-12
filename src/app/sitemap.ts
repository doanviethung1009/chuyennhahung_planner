import type { MetadataRoute } from 'next';
import { siteConfig } from '@/content/site';
import { destinations } from '@/content/destinations';
import { getPublicContent } from '@/server/content/public';
import { itineraries } from '@/content/itineraries';
import { getPathname } from '@/i18n/navigation';
import { defaultLocale, locales } from '@/i18n/routing';

/** Story entries come from the content store, so the sitemap is built per request. */
export const dynamic = 'force-dynamic';

type Href = Parameters<typeof getPathname>[0]['href'];

function url(href: Href, locale: (typeof locales)[number]) {
  return new URL(getPathname({ href, locale }), siteConfig.url).toString();
}

/** One entry per page, each carrying the full `hreflang` alternate set. */
function entry(
  href: Href,
  options: { priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; lastModified?: string },
): MetadataRoute.Sitemap[number] {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, url(href, locale)]),
  );

  return {
    url: url(href, defaultLocale),
    priority: options.priority,
    changeFrequency: options.changeFrequency,
    ...(options.lastModified ? { lastModified: options.lastModified } : {}),
    alternates: { languages },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    entry('/', { priority: 1, changeFrequency: 'weekly' }),
    entry('/stories', { priority: 0.9, changeFrequency: 'weekly' }),
    entry('/destinations', { priority: 0.9, changeFrequency: 'monthly' }),
    entry('/map', { priority: 0.7, changeFrequency: 'monthly' }),
    entry('/itineraries', { priority: 0.9, changeFrequency: 'monthly' }),
    entry('/plan-your-trip', { priority: 0.8, changeFrequency: 'yearly' }),
    entry('/reviews', { priority: 0.7, changeFrequency: 'weekly' }),
    entry('/about', { priority: 0.6, changeFrequency: 'yearly' }),
  ];

  const stories = await (await getPublicContent()).listSitemapEntries();
  const storyPages = stories.map((story) =>
    entry(
      { pathname: '/stories/[slug]', params: { slug: story.slug } },
      {
        priority: 0.8,
        changeFrequency: 'yearly',
        lastModified: story.updatedAt,
      },
    ),
  );

  const destinationPages = destinations.map((destination) =>
    entry(
      { pathname: '/destinations/[slug]', params: { slug: destination.slug } },
      { priority: 0.8, changeFrequency: 'monthly' },
    ),
  );

  const itineraryPages = itineraries.map((itinerary) =>
    entry(
      { pathname: '/itineraries/[slug]', params: { slug: itinerary.slug } },
      { priority: 0.8, changeFrequency: 'monthly' },
    ),
  );

  return [...staticPages, ...storyPages, ...destinationPages, ...itineraryPages];
}
