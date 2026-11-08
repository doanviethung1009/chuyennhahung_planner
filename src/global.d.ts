import type messages from '../messages/vi.json';
import type { routing } from '@/i18n/routing';

/**
 * Teaches next-intl our locale union and message shape, so `t('…')` keys and
 * `getLocale()` are both checked at compile time. Vietnamese is the reference
 * catalogue — a key that exists only in English will not type-check.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
