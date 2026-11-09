import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * One document, two methods. Persistence sits behind this interface so that
 * swapping in SQL later is a new adapter and nothing else — the repositories
 * above it hold every invariant and never learn where the bytes live
 * (`docs/adr/0001-travel-content-system.md` §1).
 *
 * Both the Travel Content System and the Planner are built on this. They keep
 * **separate documents** on purpose: the Planner holds private traveller data
 * and the content store holds editorial material, and a single file would mean
 * one lock, one blast radius and one backup policy for both
 * (`docs/adr/0002-planner-core.md` §1).
 */
export interface DocumentStore<T> {
  read(): Promise<T>;
  write(next: T): Promise<void>;
}

/**
 * In-memory store. Used by tests and previews: every instance is isolated and
 * seeded independently, so test order cannot leak state. Reads and writes are
 * structurally cloned, so a caller can never hold a reference into the store.
 */
export function createMemoryDocumentStore<T>(initial: T): DocumentStore<T> {
  let current = structuredClone(initial);

  return {
    async read() {
      return structuredClone(current);
    },
    async write(next) {
      current = structuredClone(next);
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
 *
 * `normalize` fills in collections a hand-edited or older file is missing, so a
 * partial document reads back as a complete one instead of throwing.
 *
 * The parsed document is cached in memory after the first read and replaced
 * only once a write has reached disk, so a read costs a `structuredClone`
 * instead of a file read plus `JSON.parse`. That relies on the same
 * one-process rule as above: this process is the only writer, so the cache
 * cannot go stale. A hand-edit of the file while the server runs is not picked
 * up — restart after editing. Both reads and writes clone, exactly like the
 * memory store, because the repositories mutate what they read in place and a
 * failed transaction must not leave its half-applied change in the cache.
 */
export function createJsonDocumentStore<T>(
  filePath: string,
  normalize: (parsed: Partial<T>) => T,
): DocumentStore<T> {
  const absolutePath = resolve(filePath);
  let queue: Promise<unknown> = Promise.resolve();
  let cached: T | undefined;

  function enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = queue.then(task, task);
    // Keep the chain alive even if one task rejects, so a failed write does not
    // wedge every later write behind it.
    queue = run.catch(() => undefined);
    return run;
  }

  async function readFromDisk(): Promise<T> {
    try {
      const raw = await readFile(absolutePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') {
        throw new Error(`store at ${absolutePath} is not an object`);
      }
      return normalize(parsed as Partial<T>);
    } catch (error) {
      if (isMissingFile(error)) return normalize({});
      throw error;
    }
  }

  return {
    read() {
      return enqueue(async () => {
        if (cached === undefined) cached = await readFromDisk();
        return structuredClone(cached);
      });
    },
    write(next) {
      return enqueue(async () => {
        await mkdir(dirname(absolutePath), { recursive: true });
        const temp = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
        const body = `${JSON.stringify(next, null, 2)}\n`;
        await writeFile(temp, body, 'utf8');
        await rename(temp, absolutePath);
        // Only after the rename, so a failed write leaves the cache matching
        // disk. Parsed from the bytes just written — not cloned from `next` —
        // so the cache is exactly what a cold read would return (JSON drops
        // `undefined` keys and turns a Date into a string; a clone would not).
        cached = normalize(JSON.parse(body) as Partial<T>);
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
