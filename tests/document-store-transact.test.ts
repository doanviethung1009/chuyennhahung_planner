import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  n: number;
}
const normalize = (parsed: Partial<Doc>): Doc => ({ items: parsed.items ?? [], n: parsed.n ?? 0 });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'transact-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const makers: Array<[string, () => DocumentStore<Doc>]> = [
  ['memory store', () => createMemoryDocumentStore<Doc>({ items: [], n: 0 })],
  ['JSON store', () => createJsonDocumentStore<Doc>(join(dir, 'doc.json'), normalize)],
];

describe.each(makers)('transact on the %s', (_name, make) => {
  it('persists what the callback changed and returns its result', async () => {
    const store = make();
    const result = await store.transact((data) => {
      data.items.push('a');
      data.n = 7;
      return 'done';
    });
    expect(result).toBe('done');
    expect(await store.read()).toEqual({ items: ['a'], n: 7 });
  });

  it('writes nothing when the callback throws, sync or async', async () => {
    const store = make();
    await store.transact((data) => void data.items.push('kept'));

    await expect(
      store.transact((data) => {
        data.items.push('lost');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(
      store.transact(async (data) => {
        data.n = 99;
        throw new Error('later');
      }),
    ).rejects.toThrow('later');

    expect(await store.read()).toEqual({ items: ['kept'], n: 0 });
    // ...and the queue is not wedged by the failures.
    await store.transact((data) => void data.items.push('after'));
    expect((await store.read()).items).toEqual(['kept', 'after']);
  });

  it('serialises overlapping transactions: no lost update', async () => {
    const store = make();
    await Promise.all(
      Array.from({ length: 25 }, () =>
        store.transact(async (data) => {
          const seen = data.n;
          await new Promise((resolve) => setTimeout(resolve, 1));
          data.n = seen + 1;
        }),
      ),
    );
    expect((await store.read()).n).toBe(25);
  });

  it('hands the callback a private copy', async () => {
    const store = make();
    let leaked: Doc | undefined;
    await store.transact((data) => {
      leaked = data;
      data.items.push('x');
    });
    leaked!.items.push('mutated later');
    expect((await store.read()).items).toEqual(['x']);
  });
});

it('the JSON store puts a transaction on disk', async () => {
  const file = join(dir, 'doc.json');
  await createJsonDocumentStore<Doc>(file, normalize).transact((data) => void data.items.push('z'));
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ items: ['z'], n: 0 });
});
