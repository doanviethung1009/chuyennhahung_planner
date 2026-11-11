import type { MetadataRoute } from 'next';
import { siteConfig } from '@/content/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/quan-tri', '/en/admin'] },
    sitemap: new URL('/sitemap.xml', siteConfig.url).toString(),
    host: siteConfig.url,
  };
}
