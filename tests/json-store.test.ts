import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJsonDocumentStore } from '../src/server/persistence/json-store';

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
