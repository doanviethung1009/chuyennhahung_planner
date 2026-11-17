import type { Locale } from '@/i18n/routing';
import { formatVnd } from '@/lib/format';

/** Minutes → "45 phút" / "2 giờ" / "1 giờ 30 phút", via the `places` messages. */
export function placeDurationParts(totalMinutes: number): { key: 'minutes' | 'hours' | 'hoursMinutes'; values: Record<string, number> } {
  if (totalMinutes < 60) return { key: 'minutes', values: { minutes: totalMinutes } };
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0
    ? { key: 'hours', values: { hours } }
    : { key: 'hoursMinutes', values: { hours, minutes } };
}

/** `formatVnd` abbreviates to millions, which turns 50.000 đ into "0,1 triệu đ"; place costs are often small. */
export function formatPlaceCost(amount: number, locale: Locale): string {
  if (locale === 'vi' && amount < 1_000_000) {
    return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
  }
  return formatVnd(amount, locale);
}
