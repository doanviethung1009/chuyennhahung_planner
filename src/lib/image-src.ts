/**
 * Hosts `next.config.ts` lists in `images.remotePatterns`. Keep in step with it.
 * CMS content may reference any https host (`imageRefSchema`), and `next/image`
 * throws for a host that is not configured, so those are served unoptimized.
 */
const OPTIMIZED_HOSTS = new Set(['images.unsplash.com']);

/** True when `next/image` may optimize `src`; false means render it `unoptimized`. */
export function canOptimizeImage(src: string): boolean {
  if (src.endsWith('.svg')) return false;
  if (src.startsWith('/')) return true;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && OPTIMIZED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
