import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedTravelContent } from '../src/content/travel/seed';
import { TravelContentRepository } from '../src/server/content/repository';
import { createMemoryStore, type ContentStore } from '../src/server/content/store';
import { readMigrationFiles, runMigrations } from '../src/server/persistence/migrate';
import { createPostgresContentStore } from '../src/server/persistence/postgres-content-store';
import { createPostgresPool } from '../src/server/persistence/postgres-pool';
import { placeFixture, storyFixture } from './travel-content-helpers';

/**
 * Travel Content against a real database (ADR 0013). Runs only when
 * `TEST_DATABASE_URL` is set; without it the file is skipped and the result
 * must be reported as NOT RUN, never as passing. Everything happens in a
 * throwaway schema created for this run and dropped at the end.
 */
const url = process.env.TEST_DATABASE_URL;

const FIXED = () => new Date('2026-03-01T08:00:00.000Z');

describe.skipIf(!url)('Travel Content on PostgreSQL (TEST_DATABASE_URL)', () => {
  const schema = `pgtest_${randomBytes(6).toString('hex')}`;
  let admin: pg.Pool;
  const pools: pg.Pool[] = [];
  const openPool = () => {
    const pool = createPostgresPool(url!, { options: `-c search_path=${schema}`, max: 5 });
    pools.push(pool);
    return pool;
  };
  let pool: pg.Pool;
  let store: ContentStore;

  /** Counted ids, as in `makeRepository`, so two stores can be compared exactly. */
  const make = (target: ContentStore) => {
    let counter = 0;
    return new TravelContentRepository({
      store: target,
      now: FIXED,
      newId: () => `act_${++counter}`,
    });
  };
  const repo = (target: ContentStore = store) => make(target);

  beforeAll(async () => {
    admin = createPostgresPool(url!, { max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = openPool();
    await runMigrations(pool, await readMigrationFiles('db/migrations'));
    store = createPostgresContentStore(pool);
  });

  afterAll(async () => {
    for (const open of pools) await open.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });

  beforeEach(async () => {
    // Emptying the tables behind a store's back: moving the revision is what
    // tells every cached store, exactly as a real commit would.
    await pool.query('UPDATE content_revision SET revision = revision + 1');
    await pool.query(
      'TRUNCATE content_templates, content_collections, content_stories, content_reviews, content_places RESTART IDENTITY',
    );
  });

  it('applies 0004 and records it', async () => {
    const recorded = await pool.query('SELECT name FROM schema_migrations');
    expect(recorded.rows.map((row) => row.name)).toContain('0004_content.sql');
  });

  it('ends the seed in the same state as the in-memory store', async () => {
    const memory = createMemoryStore();
    await seedTravelContent(make(memory));
    await seedTravelContent(repo());
    expect(await store.read()).toEqual(await memory.read());
  });

  it('edits, publishes and deletes through the repository like the memory store', async () => {
    const run = async (target: ContentStore) => {
      const repository = make(target);
      await seedTravelContent(repository);
      await repository.createPlace(placeFixture({ slug: 'cho-dem-test' }));
      await repository.updatePlace('cho-dem-test', { suggestedMinutes: 90 });
      await repository.createStory(storyFixture({ slug: 'chuyen-thu-nghiem' }));
      await repository.setStoryStatus('chuyen-thu-nghiem', { action: 'publish' });
      await repository.setStoryStatus('chuyen-thu-nghiem', { action: 'unpublish' });
      await repository.deleteStory('chuyen-thu-nghiem');
      await repository.deletePlace('cho-dem-test');
    };
    const memory = createMemoryStore();
    await run(memory);
    await run(store);
    expect(await store.read()).toEqual(await memory.read());
  });

  it('refuses to delete a referenced place with place_in_use and counts, like the memory store', async () => {
    const run = async (target: ContentStore) => {
      const repository = make(target);
      await repository.createPlace(placeFixture({ slug: 'cho-dang-dung' }));
      await repository.createStory(storyFixture({ slug: 'chuyen-dung-cho', placeSlugs: ['cho-dang-dung'] }));
      const usage = await repository.countPlaceReferences('cho-dang-dung');
      let code = '';
      let details: unknown = null;
      try {
        await repository.deletePlace('cho-dang-dung');
      } catch (error) {
        const e = error as { code: string; details: unknown };
        code = e.code;
        details = e.details;
      }
      await repository.deleteStory('chuyen-dung-cho');
      await repository.deletePlace('cho-dang-dung');
      return { usage, code, details };
    };
    const memory = await run(createMemoryStore());
    const onPg = await run(store);
    expect(onPg).toEqual(memory);
    expect(onPg.usage).toEqual({ stories: 1, collections: 0, templates: 0, contentReviews: 0 });
    expect(onPg.code).toBe('place_in_use');
  });

  it('keeps slug lists, dates, enums and nullable fields intact in the tables', async () => {
    await seedTravelContent(repo());
    const story = (await store.read()).stories[0]!;
    const row = (
      await pool.query(
        'SELECT place_slugs, travel_start::text AS start, status, destination_slug FROM content_stories WHERE slug = $1',
        [story.slug],
      )
    ).rows[0];
    expect(row.place_slugs).toEqual(story.placeSlugs);
    expect(row.start).toBe(story.travelDates.start);
    expect(row.status).toBe(story.status);
    expect(row.destination_slug).toBe(story.destinationSlug);
  });

  it('enforces the primary key and the CHECK constraints in the database', async () => {
    await seedTravelContent(repo());
    const place = (await store.read()).places[0]!;
    await expect(
      pool.query(
        `INSERT INTO content_places (slug, name, destination_slug, location, lat, lng, category,
           images, description, suggested_minutes, estimated_cost_vnd, affiliate_links, created_at, updated_at)
         VALUES ($1, '{}', 'x', '{}', 0, 0, 'cafe', '[]', '{}', 10, 0, '[]', now(), now())`,
        [place.slug],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      pool.query(`UPDATE content_stories SET status = 'bogus'`),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('never loses an update between two pools writing at once', async () => {
    const other = createPostgresContentStore(openPool());
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        repo(i % 2 === 0 ? store : other).createPlace(placeFixture({ slug: `diem-den-${i}` })),
      ),
    );
    const slugs = (await store.read()).places.map((place) => place.slug).sort();
    expect(slugs).toHaveLength(12);
    expect(new Set(slugs).size).toBe(12);
  });

  it("sees another instance's write on its next read (revision-validated cache)", async () => {
    const other = createPostgresContentStore(openPool());
    expect((await store.read()).places).toHaveLength(0); // warms store's cache
    await repo(other).createPlace(placeFixture({ slug: 'diem-moi' }));
    expect((await store.read()).places.map((place) => place.slug)).toEqual(['diem-moi']);
  });

  it('creates a story as a draft and a place, and refuses a duplicate slug without overwriting (P07-16)', async () => {
    const repository = repo();
    await seedTravelContent(repository);
    const story = await repository.createStory(storyFixture({ slug: 'pg-create-story' }));
    expect(story.status).toBe('draft');
    expect(story.publishedAt).toBeNull();
    expect((await repository.listStories({ status: 'published' } as never)).some((item) => item.slug === 'pg-create-story')).toBe(false);

    await repository.createPlace(placeFixture({ slug: 'pg-create-place' }));
    const other = { vi: 'Ghi đè', en: 'Overwrite' };
    await expect(repository.createStory(storyFixture({ slug: 'pg-create-story', excerpt: other }))).rejects.toMatchObject({ code: 'slug_conflict' });
    await expect(repository.createPlace(placeFixture({ slug: 'pg-create-place', location: other }))).rejects.toMatchObject({ code: 'slug_conflict' });
    expect((await repository.getStory('pg-create-story')).excerpt.en).not.toBe('Overwrite');

    const archived = await repository.setStoryStatus('pg-create-story', { action: 'archive' });
    expect(archived.status).toBe('archived');
  });

  it('rolls back a mutation that throws and leaves the revision alone', async () => {
    const before = String((await pool.query('SELECT revision FROM content_revision')).rows[0].revision);
    await expect(
      store.transact((data) => {
        data.places.push(placeFixture({ slug: 'se-khong-ton-tai' }) as never);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await store.read()).places).toHaveLength(0);
    const after = String((await pool.query('SELECT revision FROM content_revision')).rows[0].revision);
    expect(after).toBe(before);
  });
});
