import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/**
 * Sent on every response. Deliberately no `script-src`/`style-src` CSP yet:
 * Next's inline bootstrap and the JSON-LD block would need per-request nonces,
 * which forces dynamic rendering on every page — a decision of its own. The
 * directives below restrict framing, plugins, `<base>` and form targets, and
 * cannot break a script. The share surfaces get `no-referrer` instead — see
 * `headers()` below.
 */
export const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Ignored by browsers over plain HTTP, so harmless in development.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const noReferrer = { key: 'Referrer-Policy', value: 'no-referrer' };

/** Every path that carries a share token: the API and both localized pages. */
export const sharePaths = ['/api/shared/:path*', '/chia-se/:path*', '/en/shared/:path*'];

/**
 * The shared member map (ADR 0030 §5): a token in the path, a page only. The
 * header set is restated here so it is testable and so a layout or a proxy rule
 * cannot weaken it: never indexed, never cached, never leaked through `Referer`.
 */
export const mapSharePaths = ['/ban-do-chia-se/:path*', '/en/shared-map/:path*'];

/** The admin portal (ADR 0010) is never indexed, in either locale. */
export const adminPaths = ['/quan-tri/:path*', '/en/admin/:path*'];

const noIndex = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

/**
 * The home page shows a signed-in member a personal band (ADR 0022), so a
 * request that carries the session cookie must never be stored by a shared
 * cache. Next already answers dynamic renders `private, no-store`; this states
 * it explicitly and testably. Guests are unaffected. The cookie name mirrors
 * `SESSION_COOKIE` in `src/server/planner/auth.ts` (a test keeps them equal).
 */
export const homePaths = ['/', '/en'];
/** The member home (map + trips, ADR 0031) is per-member at the same URL, so every response is private (ADR 0029). */
export const memberMapPaths = ['/chuyen-di-cua-toi', '/en/my-trips'];
export const sessionCookieName = 'planner_session';
const privateNoStore = { key: 'Cache-Control', value: 'private, no-store' };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A self-contained server bundle for the Docker image (`Dockerfile`): only the
  // traced runtime files, no dev dependencies. `next start` keeps working.
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // A config header replaces one a route sets itself, and the last matching
      // rule wins, so the share surfaces restate their stricter policy here
      // (ADR 0005: a share token must never leak through `Referer`).
      ...sharePaths.map((source) => ({ source, headers: [noReferrer] })),
      ...mapSharePaths.map((source) => ({
        source,
        headers: [noReferrer, noIndex, { key: 'Cache-Control', value: 'private, no-store' }],
      })),
      ...adminPaths.map((source) => ({ source, headers: [noIndex] })),
      ...memberMapPaths.map((source) => ({ source, headers: [privateNoStore] })),
      ...homePaths.map((source) => ({
        source,
        has: [{ type: 'cookie' as const, key: sessionCookieName }],
        headers: [privateNoStore],
      })),
    ];
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  async redirects() {
    // Legacy tour URLs are preserved: tours are modelled as itineraries.
    // See README "Tour routes" for the mapping rationale.
    return [
      { source: '/tour', destination: '/len-lich-trinh', permanent: true },
      { source: '/tours', destination: '/len-lich-trinh', permanent: true },
      { source: '/tour/:slug', destination: '/len-lich-trinh/:slug', permanent: true },
      { source: '/tours/:slug', destination: '/len-lich-trinh/:slug', permanent: true },
      { source: '/en/tour', destination: '/en/itineraries', permanent: true },
      { source: '/en/tours', destination: '/en/itineraries', permanent: true },
      { source: '/en/tour/:slug', destination: '/en/itineraries/:slug', permanent: true },
      { source: '/en/tours/:slug', destination: '/en/itineraries/:slug', permanent: true },
      // The member map merged into My Trips (ADR 0031).
      { source: '/ban-do-cua-toi', destination: '/chuyen-di-cua-toi', permanent: true },
      { source: '/en/my-map', destination: '/en/my-trips', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
