import type { Locale } from '@/i18n/routing';
import type { TripView } from '@/server/planner/repository';

/**
 * Runs one write against the trip. `request` receives the version the page last
 * read and must return the full `TripView` the API answers every write with.
 * Resolves true when the write landed, so a form knows whether it can close.
 */
export interface MutateOptions {
  /** Shown instead of the generic message when the API answers 409 for this write. */
  conflictMessage?: string;
  /** The control that triggered the write disappears on success: move focus to the status message. */
  refocus?: boolean;
}
export type Mutate = (
  done: string,
  request: (version: number) => Promise<TripView>,
  options?: MutateOptions,
) => Promise<boolean>;

/** Mirrors `ACTIVITIES_PER_DAY_LIMIT` in the API (server code is not imported into the browser bundle). */
export const ACTIVITIES_PER_DAY_LIMIT = 40;

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
