import type { SocialLink } from './types';

/**
 * ⚠️ OWNER ACTION REQUIRED
 * The handles and contact details below are plausible defaults, not verified
 * accounts. Replace them with the real ones before going live. Every link here
 * is rendered in the header, footer and reviews page.
 */
export const siteConfig = {
  name: 'Chuyện Nhà Hưng',
  tagline: {
    vi: 'Đi đâu cũng có chuyện.',
    en: 'Every road has a story.',
  },
  /** Used for canonical URLs, sitemap and Open Graph. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chuyennhahung.vn',
  contactEmail: 'hello@chuyennhahung.vn',
  tiktokHandle: 'chuyennhahung9495',
  facebookHandle: 'chuyennhahung',
} as const;

export const social: SocialLink[] = [
  {
    platform: 'tiktok',
    label: 'TikTok',
    url: `https://www.tiktok.com/@${siteConfig.tiktokHandle}`,
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    url: `https://www.facebook.com/${siteConfig.facebookHandle}`,
  },
  {
    platform: 'email',
    label: 'Email',
    url: `mailto:${siteConfig.contactEmail}`,
  },
];
