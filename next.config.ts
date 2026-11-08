import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
    ];
  },
};

export default withNextIntl(nextConfig);
