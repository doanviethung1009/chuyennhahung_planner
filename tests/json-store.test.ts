import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createJsonDocumentStore,
  createMemoryDocumentStore,
  type DocumentStore,
} from '../src/server/persistence/json-store';

interface Doc {
  items: string[];
  note?: string;
}

const normalize = (parsed: Partial<Doc>): Doc => ({ items: [], ...parsed });

let workdir: string;
let file: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'json-store-'));
  file = join(workdir, 'doc.json');
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('createJsonDocumentStore', () => {
  it('reads a missing file as the normalized empty document', async () => {
    const store = createJsonDocumentStore<Doc>(file, normalize);
    expect(await store.read()).toEqual({ items: [] });
  });

  it('writes to disk and reads its own write back', async () => {
    const store = createJsonDocumentStore<Doc>(file, normalize);
    await store.write({ items: ['a'] });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ items: ['a'] });
    expect(await store.read()).toEqual({ items: ['a'] });
  });

  it('serves reads from memory after the first one', async () => {
    await writeFile(file, JSON.stringify({ items: ['disk'] }), 'utf8');
    const store = createJsonDocumentStore<Doc>(file, normalize);
    expect(await store.read()).toEqual({ items: ['disk'] });

    // This process is the only writer, so an out-of-band edit is not re-read.
    await writeFile(file, JSON.stringify({ items: ['edited'] }), 'utf8');
    expect(await store.read()).toEqual({ items: ['disk'] });
  });

  it('never hands out a reference into the cache', async () => {
    const store = createJsonDocumentStore<Doc>(file, normalize);
    await store.write({ items: ['a'] });

    const first = await store.read();
    first.items.push('mutated without a write');
    expect(await store.read()).toEqual({ items: ['a'] });

    const next: Doc = { items: ['b'] };
    await store.write(next);
    next.items.push('mutated after the write');
    expect(await store.read()).toEqual({ items: ['b'] });
  });

  it('caches what a cold read would return, not the object it was given', async () => {
    const store = createJsonDocumentStore<Doc>(file, normalize);
    await store.write({ items: [], note: undefined });
    const warm = await store.read();
    const cold = await createJsonDocumentStore<Doc>(file, normalize).read();
    expect(warm).toStrictEqual(cold);
    expect('note' in warm).toBe(false);
  });

  it('keeps the previous document when a write fails', async () => {
    const store = createJsonDocumentStore<Doc>(file, normalize);
    await store.write({ items: ['kept'] });

    const circular: Record<string, unknown> = { items: [] };
    circular.self = circular;
    await expect(store.write(circular as unknown as Doc)).rejects.toThrow();

    expect(await store.read()).toEqual({ items: ['kept'] });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ items: ['kept'] });
  });
});

/**
 * The `transact` contract, run against every in-process store. A later shared
 * store (ADR 0008 follow-up 2) is expected to pass the same cases.
 */
const stores: Array<[string, (initial: Doc) => Promise<DocumentStore<Doc>>]> = [
  ['memory', async (initial) => createMemoryDocumentStore(initial)],
  [
    'json',
    async (initial) => {
      await writeFile(file, JSON.stringify(initial), 'utf8');
      return createJsonDocumentStore<Doc>(file, normalize);
    },
  ],
];

describe.each(stores)('%s store transact', (kind, make) => {
  it('writes the mutated draft and returns the result', async () => {
    const store = await make({ items: ['a'] });
    const result = await store.transact((data) => {
      data.items.push('b');
      return data.items.length;
    });
    expect(result).toBe(2);
    expect(await store.read()).toEqual({ items: ['a', 'b'] });
    if (kind === 'json') {
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ items: ['a', 'b'] });
    }
  });

  it('writes nothing when mutate throws, and keeps working afterwards', async () => {
    const store = await make({ items: ['kept'] });
    await expect(
      store.transact(async (data) => {
        data.items.push('half-applied');
        await Promise.resolve();
        throw new Error('validation failed');
      }),
    ).rejects.toThrow('validation failed');

    expect(await store.read()).toEqual({ items: ['kept'] });
    if (kind === 'json') {
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ items: ['kept'] });
    }
    await store.transact((data) => void data.items.push('next'));
    expect(await store.read()).toEqual({ items: ['kept', 'next'] });
  });

  it('never runs two transactions at once', async () => {
    const store = await make({ items: [] });
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];
    const slow = (tag: string) =>
      store.transact(async (data) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        order.push(`start ${tag}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        data.items.push(tag);
        order.push(`end ${tag}`);
        active -= 1;
      });

    await Promise.all([slow('1'), slow('2'), slow('3')]);
    expect(maxActive).toBe(1);
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
    expect(await store.read()).toEqual({ items: ['1', '2', '3'] });
  });

  it('loses no update under overlapping read-modify-write', async () => {
    const store = await make({ items: [] });
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.transact(async (data) => {
          const seen = data.items.length;
          await Promise.resolve();
          data.items[seen] = String(i);
        }),
      ),
    );
    const { items } = await store.read();
    expect(items).toHaveLength(25);
    expect(new Set(items).size).toBe(25);
  });

  it('does not let a caller keep a reference into the store', async () => {
    const store = await make({ items: ['a'] });
    let leaked: Doc | undefined;
    await store.transact((data) => {
      leaked = data;
    });
    leaked!.items.push('mutated after commit');
    expect(await store.read()).toEqual({ items: ['a'] });
  });
});

describe('createJsonDocumentStore across module instances', () => {
  // Next.js can load the store module twice in one process (a page's server
  // bundle and a route handler's). Both must see one cache, or a session the
  // API writes is invisible to a server component (ADR 0010).
  it('shares the cache per path, so a second module copy sees the first one’s writes', async () => {
    const { vi } = await import('vitest');
    const first = createJsonDocumentStore(file, normalize);
    expect(await first.read()).toEqual({ items: [] }); // warm the cache

    vi.resetModules();
    const again = await import('../src/server/persistence/json-store');
    const second = again.createJsonDocumentStore(file, normalize);
    expect(await second.read()).toEqual({ items: [] });

    await second.write({ items: ['written by the other copy'] });
    expect(await first.read()).toEqual({ items: ['written by the other copy'] });
  });
});
