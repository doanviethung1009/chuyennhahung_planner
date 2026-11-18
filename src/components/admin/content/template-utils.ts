/** Pure helpers for the template editor (P07-6). No React, no I/O. */

export interface Localized {
  vi: string;
  en: string;
}

export interface TemplateActivity {
  id: string;
  order: number;
  title: Localized;
  placeSlug: string | null;
  startTime: string | null;
  durationMinutes: number;
  estimatedCostVnd: number;
  note: Localized | null;
}

export interface TemplateDay {
  day: number;
  title: Localized;
  summary: Localized | null;
  activities: TemplateActivity[];
}

export interface TemplateSnapshot {
  storySlug: string;
  title: Localized;
  destinationSlug: string | null;
  travelDates: { start: string; end: string };
  actualCostTotalVnd: number | null;
  placeSlugs: string[];
  storyUpdatedAt: string;
  snapshotTakenAt: string;
}

export interface TemplateRecord {
  slug: string;
  sourceStorySlug: string;
  title: Localized;
  summary: Localized;
  travelStyle: string;
  pace: string;
  groupSize: Localized;
  itinerarySlugs: string[];
  visibility: 'private' | 'public';
  days: TemplateDay[];
  durationDays: number;
  placeSlugs: string[];
  estimatedTotalVnd: number;
  version: number;
  sourceSnapshot: TemplateSnapshot;
  createdAt: string;
  updatedAt: string;
}

export const TRAVEL_STYLES = ['romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed'] as const;
export const PACES = ['relaxed', 'balanced', 'active'] as const;
export const VISIBILITIES = ['private', 'public'] as const;

/** The `templateUpdateSchema` keys edited as plain metadata (the `days` list is handled apart). */
export const META_FIELDS = ['title', 'summary', 'groupSize', 'travelStyle', 'pace', 'itinerarySlugs', 'visibility'] as const;

/** True when the source story changed after the snapshot was cut. Unknown or unparsable stamps are never "stale". */
export function isSourceStale(snapshotStoryUpdatedAt: string, currentStoryUpdatedAt: string | null | undefined): boolean {
  if (!currentStoryUpdatedAt) return false;
  const current = Date.parse(currentStoryUpdatedAt);
  const taken = Date.parse(snapshotStoryUpdatedAt);
  return Number.isFinite(current) && Number.isFinite(taken) && current > taken;
}

/** Strips server-assigned `id`, `order` and `day`: the shape `PATCH days` accepts. */
export function toDayInputs(days: readonly TemplateDay[]) {
  return days.map((day) => ({
    title: day.title,
    summary: day.summary,
    activities: day.activities.map((a) => ({
      title: a.title,
      placeSlug: a.placeSlug,
      startTime: a.startTime,
      durationMinutes: a.durationMinutes,
      estimatedCostVnd: a.estimatedCostVnd,
      note: a.note,
    })),
  }));
}

/** Whether the content of any day or activity differs (ids and order are ignored). */
export function daysChanged(saved: readonly TemplateDay[], draft: readonly TemplateDay[]): boolean {
  return JSON.stringify(toDayInputs(saved)) !== JSON.stringify(toDayInputs(draft));
}

/**
 * The PATCH body for a draft: only the metadata keys that changed, plus `days`
 * only when activity content changed (a `days` patch re-issues activity ids).
 */
export function buildPatch(saved: TemplateRecord, draft: TemplateRecord): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of META_FIELDS) {
    if (JSON.stringify(saved[key]) !== JSON.stringify(draft[key])) patch[key] = draft[key];
  }
  if (daysChanged(saved.days, draft.days)) patch.days = toDayInputs(draft.days);
  return patch;
}

/** New id order after moving the item at `index` by `delta` places, or null when it cannot move. */
export function shiftIds(ids: readonly string[], index: number, delta: -1 | 1): string[] | null {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as string);
  return next;
}

/** `toIndex` that appends to a day (the API caps the index at 19). */
export function appendIndex(day: TemplateDay | undefined): number {
  return Math.min(day?.activities.length ?? 0, 19);
}

/** A day that holds one activity cannot give it up: the server refuses to leave a day empty. */
export function canMoveOut(day: TemplateDay): boolean {
  return day.activities.length > 1;
}

/** Server issue paths use `days[0].activities[1].x`; the form kit uses dots. */
export function normalizeIssuePath(path: string): string {
  return path.replace(/\[(\d+)\]/g, '.$1');
}
