import type { Metadata } from 'next';
import { siteConfig } from '@/content/site';
import { getPathname } from '@/i18n/navigation';
import { defaultLocale, locales, type Locale } from '@/i18n/routing';

type Href = Parameters<typeof getPathname>[0]['href'];

function absolute(href: Href, locale: Locale): string {
  return new URL(getPathname({ href, locale }), siteConfig.url).toString();
}

/**
 * Canonical URL plus a complete `hreflang` set. `x-default` points at the
 * Vietnamese page because Vietnamese is the primary audience.
 */
export function buildAlternates(href: Href, locale: Locale) {
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = absolute(href, l);
  }
  languages['x-default'] = absolute(href, defaultLocale);

  return { canonical: absolute(href, locale), languages };
}

interface PageMetaInput {
  href: Href;
  locale: Locale;
  title: string;
  description: string;
  /** Path to a cover image, used for Open Graph. */
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
}

export function buildPageMetadata({
  href,
  locale,
  title,
  description,
  image,
  type = 'website',
  publishedTime,
}: PageMetaInput): Metadata {
  const url = absolute(href, locale);
  const ogImage = image
    ? new URL(image, siteConfig.url).toString()
    : new URL('/opengraph-image', siteConfig.url).toString();

  return {
    title,
    description,
    alternates: buildAlternates(href, locale),
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: siteConfig.name,
      locale: locale === 'vi' ? 'vi_VN' : 'en_GB',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
