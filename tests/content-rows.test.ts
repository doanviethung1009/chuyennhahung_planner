import { describe, expect, it } from 'vitest';
import { seedTravelContent } from '../src/content/travel/seed';
import {
  collectionSchema,
  placeSchema,
  reviewSchema,
  storySchema,
  templateSchema,
} from '../src/server/content/schemas';
import { TravelContentRepository } from '../src/server/content/repository';
import { createMemoryStore, type ContentData } from '../src/server/content/store';
import { CONTENT_TABLES } from '../src/server/persistence/content-rows';
import { fromRow, planStatements, rowsToData, toRow } from '../src/server/persistence/planner-rows';

/**
 * The Travel Content mapping, offline (ADR 0013): every collection survives
 * record -> row -> record, a no-op writes nothing, and a schema field that has no
 * column fails here instead of being dropped in production.
 */

async function seeded(): Promise<ContentData> {
  const store = createMemoryStore();
  await seedTravelContent(new TravelContentRepository({ store }));
  return store.read();
}

/** What the driver would hand back for a row: dates and bigints as text, jsonb parsed. */
function asDriverRow(row: Record<string, unknown>, columns: { column: string; type: string }[]) {
  const out: Record<string, unknown> = { ...row };
  for (const { column, type } of columns) {
    const value = out[column];
    if (value === null || value === undefined) continue;
    if (type === 'bigint') out[column] = String(value);
    if (type === 'jsonb') out[column] = JSON.parse(value as string);
  }
  return out;
}

describe('content row mapping', () => {
  it('has a column for every field of every schema', () => {
    const schemas = {
      places: placeSchema,
      stories: storySchema,
      collections: collectionSchema,
      reviews: reviewSchema,
      templates: templateSchema,
    };
    for (const spec of CONTENT_TABLES) {
      const mapped = new Set(spec.columns.map((c) => c.field));
      const fields = Object.keys(schemas[spec.collection].shape);
      expect(
        fields.filter((field) => !mapped.has(field)),
        `${spec.table}: schema fields without a column`,
      ).toEqual([]);
    }
  });

  it('round-trips every seeded record, equal to what the JSON store holds', async () => {
    const data = await seeded();
    expect(data.places.length).toBeGreaterThan(0);
    expect(data.stories.length).toBeGreaterThan(0);
    expect(data.templates.length).toBeGreaterThan(0);

    const rows: Record<string, Record<string, unknown>[]> = {};
    for (const spec of CONTENT_TABLES) {
      rows[spec.table] = (data[spec.collection] as unknown as Record<string, unknown>[]).map(
        (record) => asDriverRow(toRow(spec, record), spec.columns),
      );
    }
    expect(rowsToData<ContentData>(rows, CONTENT_TABLES)).toEqual(data);
  });

  it('round-trips a place status and publish date, and writes both columns (ADR 0035)', async () => {
    const before = await seeded();
    const after = structuredClone(before);
    const place = after.places[0]!;
    place.status = 'draft';
    place.publishedAt = '2030-01-01T00:00:00.000Z';
    place.updatedAt = '2030-01-02T00:00:00.000Z';

    const statements = planStatements(before, after, CONTENT_TABLES);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.text).toContain('"status"');
    expect(statements[0]!.text).toContain('"published_at"');

    const spec = CONTENT_TABLES.find((s) => s.collection === 'places')!;
    const row = asDriverRow(toRow(spec, place as unknown as Record<string, unknown>), spec.columns);
    expect(row.status).toBe('draft');
    expect(row.published_at).toBe(place.publishedAt);
  });

  it('writes no statement for a mutation that changed nothing', async () => {
    const data = await seeded();
    expect(planStatements(data, structuredClone(data), CONTENT_TABLES)).toEqual([]);
  });

  it('updates only the changed columns, keyed by slug', async () => {
    const before = await seeded();
    const after = structuredClone(before);
    const story = after.stories[0]!;
    story.readingMinutes += 1;
    story.updatedAt = '2030-01-01T00:00:00.000Z';

    const statements = planStatements(before, after, CONTENT_TABLES);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.text).toBe(
      'UPDATE "content_stories" SET "reading_minutes" = $2, "updated_at" = $3 WHERE "slug" = $1',
    );
    expect(statements[0]!.values[0]).toBe(story.slug);
  });

  it('inserts, deletes and keys reviews by id', async () => {
    const before = await seeded();
    const after = structuredClone(before);
    const gone = after.places.shift()!;
    const review = after.reviews[0]!;
    review.rating = review.rating === 5 ? 4.5 : 5;

    const statements = planStatements(before, after, CONTENT_TABLES);
    const byKind = statements.map((s) => `${s.kind}:${s.table}`);
    expect(byKind).toContain('delete:content_places');
    expect(byKind).toContain('update:content_reviews');
    const del = statements.find((s) => s.kind === 'delete')!;
    expect(del.text).toBe('DELETE FROM "content_places" WHERE "slug" = ANY($1::text[])');
    expect(del.values).toEqual([[gone.slug]]);
    const upd = statements.find((s) => s.table === 'content_reviews')!;
    expect(upd.text).toContain('WHERE "id" = $1');
  });

  it('binds slug lists as text[] and never interpolates values', async () => {
    const before = await seeded();
    const after = structuredClone(before);
    const story = after.stories[0]!;
    story.placeSlugs = [...story.placeSlugs, "x'); DROP TABLE content_stories; --"];

    const [statement] = planStatements(before, after, CONTENT_TABLES);
    expect(statement!.text).toBe('UPDATE "content_stories" SET "place_slugs" = $2::text[] WHERE "slug" = $1');
    expect(statement!.text).not.toContain('DROP');
  });

  it('reports a corrupt row by table and key, never by content', () => {
    const spec = CONTENT_TABLES.find((s) => s.collection === 'places')!;
    expect(() => fromRow(spec, { slug: 'da-lat-cafe', name: null })).toThrow(
      'row content_places/da-lat-cafe is unreadable: name is NULL',
    );
  });
});
