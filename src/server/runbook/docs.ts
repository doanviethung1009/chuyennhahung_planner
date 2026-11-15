import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locale } from '@/i18n/routing';

/**
 * The documents the admin Runbook tab may show. A closed allow-list of file
 * stems under `docs/`: the request supplies an id, never a path, so nothing
 * outside this list can be read (no traversal, no other files). Each has an
 * English `<id>.md` and a Vietnamese `<id>.vi.md` twin (`tests/docs.test.ts`).
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

export type RunbookDocId = (typeof RUNBOOK_DOCS)[number];

export const DEFAULT_RUNBOOK_DOC: RunbookDocId = 'runbook';

export function isRunbookDoc(value: unknown): value is RunbookDocId {
  return typeof value === 'string' && (RUNBOOK_DOCS as readonly string[]).includes(value);
}

/** `docs/` next to `package.json`; in the Docker image the runner stage copies it to `/app/docs`. */
function docsDir(): string {
  return join(process.cwd(), 'docs');
}

/** Markdown source of one allow-listed document, or `null` when the file is absent. */
export async function readRunbookDoc(id: RunbookDocId, locale: Locale): Promise<string | null> {
  const file = locale === 'vi' ? `${id}.vi.md` : `${id}.md`;
  try {
    return await readFile(join(docsDir(), file), 'utf8');
  } catch {
    return null;
  }
}
