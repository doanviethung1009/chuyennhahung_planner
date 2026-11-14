import type { Locale } from '@/i18n/routing';
import type { TripView } from '@/server/planner/repository';

/**
 * Runs one write against the trip. `request` receives the version the page last
 * read and must return the full `TripView` the API answers every write with.
 * Resolves true when the write landed, so a form knows whether it can close.
 */
export type Mutate = (done: string, request: (version: number) => Promise<TripView>) => Promise<boolean>;

export const COST_CATEGORIES = ['transport', 'stay', 'food', 'tickets', 'rental', 'shopping', 'other'] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const TRAVEL_STYLES = ['romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed'] as const;
export const PACES = ['relaxed', 'balanced', 'active'] as const;

/** Exact dong amount (the `formatVnd` helper rounds to millions, too coarse for a bill). */
export function formatDong(amount: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(amount)} ₫`;
}

/** A whole, non-negative number from a text input; null when it is not one. */
export function wholeNumber(raw: string, min: number, max: number): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}
