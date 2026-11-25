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

  it('keeps a draft place a draft, and reads a place with no status as published (ADR 0035)', async () => {
    const data = await seededData();
    const draft = structuredClone(data.places[0]!);
    draft.slug = 'nhap-chua-xuat-ban';
    draft.status = 'draft';
    draft.publishedAt = null;
    const legacy = JSON.parse(JSON.stringify(data.places[1]!)) as Record<string, unknown>;
    delete legacy.status;
    delete legacy.publishedAt;
    const document = JSON.parse(JSON.stringify({ ...data, places: [...data.places.slice(0, 1), legacy, ...data.places.slice(2), draft] }));

    const target = createMemoryStore();
    await importContentDocument(target, document);
    const places = (await target.read()).places;
    expect(places.find((p) => p.slug === draft.slug)?.status).toBe('draft');
    expect(places.find((p) => p.slug === (legacy.slug as string))?.status).toBe('published');
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
