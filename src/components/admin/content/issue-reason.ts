import { isValidSlug, SLUG_MAX, SLUG_MIN } from '@/lib/slug';
import { getAt, type Json } from './form-kit';

/**
 * Why one field was refused, reduced to a key under `adminContent.form.reasons`
 * plus the number the sentence needs. The server's 422 carries English zod
 * messages and `api()` keeps only the path, so the same reading is applied to
 * the client-side check (same schema) and to a server answer.
 */
export interface Reason {
  key: 'required' | 'number' | 'minLength' | 'maxLength' | 'min' | 'max' | 'whole' | 'format' | 'reference' | 'reserved' | 'invalid';
  n?: number;
}

export interface FieldProblem {
  path: string;
  reason: Reason;
}

const number = (text: string, pattern: RegExp): number | undefined => {
  const hit = pattern.exec(text);
  return hit?.[1] === undefined ? undefined : Number(hit[1]);
};

/** Reads one zod / repository message. Unknown wording falls back to `invalid`. */
export function reasonOf(message: string): Reason {
  if (/received null|received undefined|is required/i.test(message)) return { key: 'required' };
  if (/expected number, received string/.test(message)) return { key: 'number' };
  const chars = number(message, /to have >=(\d+) characters/);
  if (chars !== undefined) return chars <= 1 ? { key: 'required' } : { key: 'minLength', n: chars };
  if (/expected array to have >=1 items/.test(message)) return { key: 'required' };
  const maxChars = number(message, /to have <=(\d+) characters/);
  if (maxChars !== undefined) return { key: 'maxLength', n: maxChars };
  const min = number(message, /to be >=(-?[\d.]+)/);
  if (min !== undefined) return { key: 'min', n: min };
  const max = number(message, /to be <=(-?[\d.]+)/);
  if (max !== undefined) return { key: 'max', n: max };
  if (/whole đồng|expected int\b/.test(message)) return { key: 'whole' };
  if (/lowercase words|must be YYYY/.test(message)) return { key: 'format' };
  if (/does not exist/.test(message)) return { key: 'reference' };
  if (/reserved/.test(message)) return { key: 'reserved' };
  return { key: 'invalid' };
}

/** Server `issues` (path + message) to problems. A path keeps its first reason. */
export function problemsFromIssues(issues: readonly { path: string; message: string }[]): FieldProblem[] {
  const seen = new Set<string>();
  const out: FieldProblem[] = [];
  for (const issue of issues) {
    if (seen.has(issue.path)) continue;
    seen.add(issue.path);
    out.push({ path: issue.path, reason: reasonOf(issue.message) });
  }
  return out;
}

/**
 * The create forms' check before they call the server. A client file may not import
 * `@/server/**` (ADR 0006), so this mirrors the create schemas; the server stays the
 * authority and `tests/admin-place-create-check.test.ts` fails when the two disagree
 * about which fields are refused.
 */
type Sink = (path: string, reason: Reason) => void;

function checkSlug(draft: unknown, path: string, reserve: boolean, add: Sink): void {
  const raw = getAt(draft as Json, path);
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') add(path, { key: 'required' });
  else if (reserve && value === 'new') add(path, { key: 'reserved' });
  else if (value.length < SLUG_MIN) add(path, { key: 'minLength', n: SLUG_MIN });
  else if (value.length > SLUG_MAX) add(path, { key: 'maxLength', n: SLUG_MAX });
  else if (!isValidSlug(value)) add(path, { key: 'format' });
}

/** Story create form: only the slug is checked here; the server names the rest. */
export function checkSlugDraft(draft: unknown): FieldProblem[] {
  const out: FieldProblem[] = [];
  checkSlug(draft, 'slug', true, (path, reason) => out.push({ path, reason }));
  return out;
}

export function checkPlaceDraft(draft: unknown): FieldProblem[] {
  const out: FieldProblem[] = [];
  const at = (path: string) => getAt(draft as Json, path);
  const add: Sink = (path, reason) => out.push({ path, reason });

  const text = (path: string) => {
    for (const locale of ['vi', 'en']) {
      const value = at(`${path}.${locale}`);
      if (typeof value !== 'string' || value.trim() === '') add(`${path}.${locale}`, { key: 'required' });
    }
  };
  const num = (path: string, min: number, max: number, whole: boolean) => {
    const value = at(path);
    if (value === null || value === undefined) add(path, { key: 'required' });
    // Typed text the number reader could not understand stays a string (`number-text.ts`).
    else if (typeof value !== 'number' || !Number.isFinite(value)) add(path, { key: 'number' });
    else if (whole && !Number.isInteger(value)) add(path, { key: 'whole' });
    else if (value < min) add(path, { key: 'min', n: min });
    else if (value > max) add(path, { key: 'max', n: max });
  };

  checkSlug(draft, 'slug', true, add);
  text('name');
  checkSlug(draft, 'destinationSlug', false, add);
  text('location');
  num('coords.lat', -90, 90, false);
  num('coords.lng', -180, 180, false);
  for (const locale of ['vi', 'en']) {
    const list = at(`description.${locale}`);
    if (!Array.isArray(list) || !list.some((item) => typeof item === 'string' && item.trim() !== '')) {
      add(`description.${locale}`, { key: 'required' });
    }
  }
  num('suggestedMinutes', 5, 24 * 60, true);
  num('estimatedCostVnd', 0, 1_000_000_000_000, true);
  return out;
}
