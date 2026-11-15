import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locale } from '@/i18n/routing';

/**
 * The documents the admin Runbook tab may show. A closed set: the request
 * supplies an id, never a path, so nothing outside it can be read.
 *
 * - Core documents: the fixed list below, file stems under `docs/`.
 * - Feature documents: `features/<slug>`, where `<slug>` must be a file that
 *   really exists in `docs/features/` (listed from disk, not from the
 *   request) and match a strict slug pattern.
 *
 * Each has an English `<id>.md` and a Vietnamese `<id>.vi.md` twin
 * (`tests/docs.test.ts`).
 */
export const RUNBOOK_DOCS = [
  'runbook',
  'deploy-runbook',
  'deploy-operations',
  'deploy-database',
  'deploy-runner',
  'runbook-api',
  'runbook-google-sign-in',
  'architecture',
  'usage',
  'travel-content-api',
] as const;

export type CoreRunbookDocId = (typeof RUNBOOK_DOCS)[number];
/** A core id, or `features/<slug>`. */
export type RunbookDocId = string;

export const DEFAULT_RUNBOOK_DOC: CoreRunbookDocId = 'runbook';

const FEATURE_PREFIX = 'features/';
const FEATURE_SLUG = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export function isCoreRunbookDoc(value: unknown): value is CoreRunbookDocId {
  return typeof value === 'string' && (RUNBOOK_DOCS as readonly string[]).includes(value);
}

/** `docs/` next to `package.json`; in the Docker image the runner stage copies it to `/app/docs`. */
function docsDir(): string {
  return join(process.cwd(), 'docs');
}

/** Slugs of the English feature documents on disk (the register and the template excluded). */
export async function listFeatureSlugs(): Promise<string[]> {
  try {
    const names = await readdir(join(docsDir(), 'features'));
    return names
      .filter((name) => name.endsWith('.md') && !name.endsWith('.vi.md'))
      .map((name) => name.slice(0, -'.md'.length))
      .filter((slug) => FEATURE_SLUG.test(slug))
      .sort();
  } catch {
    return [];
  }
}

/** Every id the tab can show right now. */
export async function knownRunbookDocs(): Promise<Set<string>> {
  const features = await listFeatureSlugs();
  return new Set<string>([...RUNBOOK_DOCS, ...features.map((slug) => `${FEATURE_PREFIX}${slug}`)]);
}

/** The id when `value` is a document the tab may show, else `null`. */
export async function resolveRunbookDoc(value: unknown): Promise<RunbookDocId | null> {
  if (isCoreRunbookDoc(value)) return value;
  if (typeof value !== 'string' || !value.startsWith(FEATURE_PREFIX)) return null;
  const slug = value.slice(FEATURE_PREFIX.length);
  if (!FEATURE_SLUG.test(slug)) return null;
  return (await listFeatureSlugs()).includes(slug) ? value : null;
}

/** Markdown source of one document, or `null` when the id is not allowed or the file is absent. */
export async function readRunbookDoc(id: RunbookDocId, locale: Locale): Promise<string | null> {
  if (!isCoreRunbookDoc(id) && !(id.startsWith(FEATURE_PREFIX) && FEATURE_SLUG.test(id.slice(FEATURE_PREFIX.length)))) {
    return null;
  }
  const file = locale === 'vi' ? `${id}.vi.md` : `${id}.md`;
  try {
    return await readFile(join(docsDir(), file), 'utf8');
  } catch {
    return null;
  }
}

/** A document's title: its first `# ` heading without the "Feature — " style prefix. */
export function documentTitle(source: string | null, fallback: string): string {
  const heading = /^#\s+(.+)$/m.exec(source ?? '')?.[1]?.trim();
  if (!heading) return fallback;
  return heading.replace(/^(Feature|Tính năng)\s+[—-]\s+/, '');
}
