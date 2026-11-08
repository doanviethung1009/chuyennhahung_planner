import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type {
  DestinationCollection,
  Place,
  TravelReview,
  TravelStory,
  TravelTemplate,
} from './schemas';

/**
 * The whole content set, as one document. Persistence is deliberately behind
 * this two-method interface: swapping in SQL later is a new adapter and nothing
 * else (see `docs/adr/0001-travel-content-system.md` §1).
 */
export interface ContentData {
  places: Place[];
  stories: TravelStory[];
  collections: DestinationCollection[];
  reviews: TravelReview[];
  templates: TravelTemplate[];
}

export interface ContentStore {
  read(): Promise<ContentData>;
  write(next: ContentData): Promise<void>;
}

export function emptyContentData(): ContentData {
  return { places: [], stories: [], collections: [], reviews: [], templates: [] };
}

/** Structural clone, so a caller can never hold a reference into the store. */
function clone(data: ContentData): ContentData {
  return structuredClone(data);
}

/**
 * In-memory store. Used by tests and previews: every instance is isolated and
 * seeded independently, so test order cannot leak state.
 */
export function createMemoryStore(initial: ContentData = emptyContentData()): ContentStore {
  let current = clone(initial);

  return {
    async read() {
      return clone(current);
    },
    async write(next) {
      current = clone(next);
    },
  };
}

/**
 * JSON-file store for development and single-instance self-hosting.
 *
 * Writes go to a temp file and are then `rename`d over the target, which is
 * atomic on POSIX — a crash mid-write leaves the previous file intact rather
 * than a truncated one. Writes are also serialised through an in-process queue
 * so two overlapping requests cannot interleave a read-modify-write.
 *
 * Accepted limit (ADR 0001 §1): this is safe for ONE Node process. It is not a
 * multi-instance or serverless store. Multi-instance deployment is the trigger
 * to move to SQL.
 */
export function createJsonFileStore(filePath: string): ContentStore {
  const absolutePath = resolve(filePath);
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    // Keep the chain alive even if one task rejects, so a failed write does not
    // wedge every later write behind it.
    queue = run.catch(() => undefined);
    return run;
  }

  async function readFromDisk(): Promise<ContentData> {
    try {
      const raw = await readFile(absolutePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') {
        throw new Error(`content store at ${absolutePath} is not an object`);
      }
      const partial = parsed as Partial<ContentData>;
      return {
        places: partial.places ?? [],
        stories: partial.stories ?? [],
        collections: partial.collections ?? [],
        reviews: partial.reviews ?? [],
        templates: partial.templates ?? [],
      };
    } catch (error) {
      if (isMissingFile(error)) return emptyContentData();
      throw error;
    }
  }

  return {
    read() {
      return enqueue(readFromDisk);
    },
    write(next) {
      return enqueue(async () => {
        await mkdir(dirname(absolutePath), { recursive: true });
        const temp = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        await rename(temp, absolutePath);
      });
    },
  };
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
