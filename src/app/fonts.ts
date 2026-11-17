import { Be_Vietnam_Pro, Lora } from 'next/font/google';

/**
 * Both families include the `vietnamese` subset — without it, diacritics fall
 * back to a system font and the page loses its typographic voice mid-word.
 * Shared by the public and the admin root layouts (ADR 0023) so the two
 * typographies cannot drift.
 */
export const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
});

export const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-be-vietnam',
  display: 'swap',
});
