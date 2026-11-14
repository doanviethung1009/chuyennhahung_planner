import { describe, expect, it } from 'vitest';
import { seedTravelContent } from '../src/content/travel/seed';
import { TravelContentRepository } from '../src/server/content/repository';
import { createMemoryStore, type ContentData } from '../src/server/content/store';
import {
  exportContentDocument,
  importContentDocument,
  parseContentDocument,
} from '../src/server/persistence/content-transfer';

/** Import and export of the content document, offline (ADR 0013 §7). */

async function seededData(): Promise<ContentData> {
  const store = createMemoryStore();
  await seedTravelContent(new TravelContentRepository({ store }));
  return store.read();
}

describe('content transfer', () => {
  it('imports a valid document into an empty store', async () => {
    const data = await seededData();
    const target = createMemoryStore();
    const summary = await importContentDocument(target, JSON.parse(JSON.stringify(data)));
    expect(summary.collections.stories).toBe(data.stories.length);
    expect(await target.read()).toEqual(data);
  });

  it('refuses a store that already holds content, and writes nothing', async () => {
    const data = await seededData();
    const target = createMemoryStore(structuredClone(data));
    await expect(importContentDocument(target, data)).rejects.toMatchObject({
      code: 'invalid_state',
    });
    expect(await target.read()).toEqual(data);
  });

  it('rejects an invalid file by path, without echoing its content', async () => {
    const data = await seededData();
    const broken = structuredClone(data) as unknown as { stories: { status: string }[] };
    broken.stories[0]!.status = 'SECRET-DRAFT-TEXT';
    const error = await importContentDocument(createMemoryStore(), broken).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'validation_failed' });
    expect(JSON.stringify(error)).not.toContain('SECRET-DRAFT-TEXT');
    expect(() => parseContentDocument({ nonsense: [] })).toThrow();
  });

  it('refuses a document with a dangling reference', async () => {
    const data = await seededData();
    const story = data.stories.find((s) => s.placeSlugs.length > 0)!;
    story.placeSlugs = [...story.placeSlugs, 'khong-co-dia-diem-nay'];
    await expect(importContentDocument(createMemoryStore(), data)).rejects.toMatchObject({
      code: 'validation_failed',
    });
  });

  it('exports a file that imports back identically', async () => {
    const data = await seededData();
    const file = await exportContentDocument(createMemoryStore(structuredClone(data)));
    const again = createMemoryStore();
    await importContentDocument(again, JSON.parse(file));
    expect(await again.read()).toEqual(data);
  });
});
