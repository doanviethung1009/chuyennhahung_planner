import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, the locale-independent Open Graph image,
  // and anything with a file extension (robots.txt, sitemap.xml, /images/*).
  matcher: ['/((?!api|_next|_vercel|opengraph-image|icon|.*\\..*).*)'],
};
