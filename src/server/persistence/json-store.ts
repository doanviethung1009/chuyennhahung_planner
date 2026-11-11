import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * One document, three methods. Persistence sits behind this interface so that
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
  /**
   * Atomic read-modify-write. `mutate` receives a private copy of the document
   * and edits it in place; once it resolves, that copy is written and its
   * result returned. If `mutate` throws (or the write fails), nothing is
   * written and the error propagates. Transactions on one store never overlap.
   *
   * The memory and JSON stores serialise on an in-process queue, which is safe
   * for one Node process only; a shared store makes this atomic across
   * instances (`docs/adr/0008-postgres-document-store.md` §3).
   */
  transact<R>(mutate: (data: T) => Promise<R> | R): Promise<R>;
  /**
   * Optional change counter for stores shared between processes. Two calls
   * return the same value only if no process committed in between, so anything
   * derived from the data (the Planner's share-token index) can be rebuilt when
   * it moves. The memory and JSON stores have one writer — this process — and
   * omit it.
   */
  revision?(): Promise<string | number>;
}

/**
 * A promise chain that runs tasks one at a time. A rejected task does not
 * wedge the chain: the next task still runs.
 */
function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/**
 * In-memory store. Used by tests and previews: every instance is isolated and
 * seeded independently, so test order cannot leak state. Reads and writes are
 * structurally cloned, so a caller can never hold a reference into the store.
 */
export function createMemoryDocumentStore<T>(initial: T): DocumentStore<T> {
  let current = structuredClone(initial);
  const enqueue = createSerialQueue();

  return {
    async read() {
      return structuredClone(current);
    },
    async write(next) {
      current = structuredClone(next);
    },
    transact(mutate) {
      return enqueue(async () => {
        const draft = structuredClone(current);
        const result = await mutate(draft);
        current = structuredClone(draft);
        return result;
      });
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
 *
 * The queue and the cache are kept per file path on `globalThis`, not per
 * module instance: Next.js can load this module more than once in one process
 * (a page's server bundle and a route handler's), and two caches of one file
 * would each miss the other's writes — a session signed in by the API would be
 * invisible to a server component (ADR 0010).
 */
export function createJsonDocumentStore<T>(
  filePath: string,
  normalize: (parsed: Partial<T>) => T,
): DocumentStore<T> {
  const absolutePath = resolve(filePath);
  // Reads, writes and transactions share one queue, so a read never observes
  // a transaction half-way and a failed task does not wedge the ones after it.
  const shared = sharedFileState(absolutePath);
  const enqueue = shared.enqueue;

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

  // These two run only inside `enqueue` and never enqueue themselves, so
  // `transact` can call both without deadlocking on its own task.
  async function readUnlocked(): Promise<T> {
    if (shared.cached === undefined) shared.cached = await readFromDisk();
    return structuredClone(shared.cached as T);
  }

  async function writeUnlocked(next: T): Promise<void> {
    await mkdir(dirname(absolutePath), { recursive: true });
    const temp = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
    const body = `${JSON.stringify(next, null, 2)}\n`;
    await writeFile(temp, body, 'utf8');
    await rename(temp, absolutePath);
    // Only after the rename, so a failed write leaves the cache matching
    // disk. Parsed from the bytes just written — not cloned from `next` —
    // so the cache is exactly what a cold read would return (JSON drops
    // `undefined` keys and turns a Date into a string; a clone would not).
    shared.cached = normalize(JSON.parse(body) as Partial<T>);
  }

  return {
    read() {
      return enqueue(readUnlocked);
    },
    write(next) {
      return enqueue(() => writeUnlocked(next));
    },
    transact(mutate) {
      return enqueue(async () => {
        // `readUnlocked` hands out a clone, so a throw in `mutate` leaves the
        // cache untouched and nothing reaches disk.
        const draft = await readUnlocked();
        const result = await mutate(draft);
        await writeUnlocked(draft);
        return result;
      });
    },
  };
}

type SharedFileState = {
  enqueue: ReturnType<typeof createSerialQueue>;
  cached: unknown;
};

const SHARED_KEY = Symbol.for('chuyennhahung.jsonDocumentStores');

/** One queue and one cache per absolute path, for the whole process. */
function sharedFileState(absolutePath: string): SharedFileState {
  const holder = globalThis as typeof globalThis & {
    [SHARED_KEY]?: Map<string, SharedFileState>;
  };
  const registry = (holder[SHARED_KEY] ??= new Map());
  let state = registry.get(absolutePath);
  if (!state) {
    state = { enqueue: createSerialQueue(), cached: undefined };
    registry.set(absolutePath, state);
  }
  return state;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
