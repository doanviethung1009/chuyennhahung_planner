import type { Locale } from '@/i18n/routing';

const dateLocale: Record<Locale, string> = { vi: 'vi-VN', en: 'en-GB' };

/** Long-form date, e.g. "28 tháng 10, 2025" / "28 October 2025". */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(dateLocale[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Short month + year, used on cards where space is tight. */
export function formatMonthYear(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(dateLocale[locale], {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Prices are indicative and always round, so we drop the decimals and
 * abbreviate millions the way Vietnamese travel writing does.
 */
export function formatVnd(amount: number, locale: Locale): string {
  if (locale === 'vi') {
    const millions = amount / 1_000_000;
    const label = Number.isInteger(millions)
      ? String(millions)
      : millions.toFixed(1).replace('.', ',');
    return `${label} triệu đ`;
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Seconds → m:ss, for video review cards. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
