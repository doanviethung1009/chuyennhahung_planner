import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ContentError } from '../src/server/content/errors';
import { PlannerRepository } from '../src/server/planner/repository';
import { migrateOnStartup, readMigrationFiles, runMigrations } from '../src/server/persistence/migrate';
import {
  exportPlannerDocument,
  importPlannerDocument,
} from '../src/server/persistence/planner-transfer';
import { createPostgresPlannerStore } from '../src/server/persistence/postgres-planner-store';
import { createPostgresPool } from '../src/server/persistence/postgres-pool';
import { createMemoryPlannerStore, type PlannerStore } from '../src/server/planner/store';
import {
  FROZEN_NOW,
  activityInput,
  daLatTripInput,
  expenseInput,
  fakeCatalog,
  makeOwner,
  makePlanner,
} from './planner-helpers';
import { runScenario, stable } from './planner-pg-fixtures';

/**
 * The Postgres store against a real database (ADR 0009). Runs only when
 * `TEST_DATABASE_URL` is set; without it the whole file is skipped and the
 * result must be reported as NOT RUN, never as passing.
 *
 * Everything happens in a throwaway schema created for this run and dropped at
 * the end, so the URL may point at any scratch database. Never point it at a
 * database that holds real data.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Planner on PostgreSQL (TEST_DATABASE_URL)', () => {
  const schema = `pgtest_${randomBytes(6).toString('hex')}`;
  let admin: pg.Pool;
  const pools: pg.Pool[] = [];

  const openPool = () => {
    const pool = createPostgresPool(url!, { options: `-c search_path=${schema}`, max: 5 });
    pools.push(pool);
    return pool;
  };
  let pool: pg.Pool;
  let store: PlannerStore;

  beforeAll(async () => {
    admin = createPostgresPool(url!, { max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = openPool();
    await runMigrations(pool, await readMigrationFiles('db/migrations'));
    store = createPostgresPlannerStore(pool);
  });

  afterAll(async () => {
    for (const open of pools) await open.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });

  beforeEach(async () => {
    // Tests empty the tables behind the stores' backs; moving the revision is
    // what tells every cached store so, exactly as a real commit would.
    await pool.query('UPDATE planner_revision SET revision = revision + 1');
    await pool.query(
      'TRUNCATE review_restrictions, community_reviews, trip_expenses, trip_activities, trip_days, trips, planner_oauth_attempts, planner_sessions, planner_users RESTART IDENTITY CASCADE',
    );
  });

  const repository = (target: PlannerStore = store) => makePlanner({ store: target });
  /** Random ids, as in production: two "processes" must not both mint usr_1. */
  const processLike = (target: PlannerStore) =>
    new PlannerRepository({
      store: target,
      catalog: fakeCatalog(),
      scryptCostLog2: 10,
      newId: (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`,
    });

  it('stores super_admin and the ban / soft-delete marks (migration 0009, ADR 0017)', async () => {
    const planner = repository();
    const boss = await planner.createUser({ handle: 'pg-boss', displayName: 'Boss', email: 'pg-boss@example.test', role: 'super_admin' });
    const staff = await planner.createUser({ handle: 'pg-staff', displayName: 'Staff', email: 'pg-staff@example.test', role: 'editor' });
    await planner.changeAccountState(staff.user.id, 'ban', { userId: boss.user.id });
    const reread = repository(createPostgresPlannerStore(openPool()));
    const users = await reread.listUsers();
    expect(users.find((u) => u.id === boss.user.id)?.role).toBe('super_admin');
    const banned = users.find((u) => u.id === staff.user.id);
    expect(banned?.bannedAt).toBeTruthy();
    expect(banned?.bannedBy).toBe(boss.user.id);
    await planner.changeAccountState(staff.user.id, 'unban', { userId: boss.user.id });
    await planner.changeAccountState(staff.user.id, 'delete', { userId: boss.user.id });
    const deleted = (await reread.listUsers()).find((u) => u.id === staff.user.id);
    expect(deleted?.deletedAt).toBeTruthy();
    expect(deleted?.bannedAt ?? null).toBeNull();
  });

  it('migrate is idempotent and records the file', async () => {
    const files = await readMigrationFiles('db/migrations');
    const report = await runMigrations(pool, files);
    expect(report.applied).toEqual([]);
    expect(report.skipped).toEqual(files.map((file) => file.name));
    const recorded = await pool.query('SELECT name FROM schema_migrations');
    expect(recorded.rows.map((row) => row.name)).toContain('0001_planner.sql');
  });

  it('ends a full scenario in the same state as the in-memory store', async () => {
    const memory = createMemoryPlannerStore();
    await runScenario(makePlanner({ store: memory }));
    await runScenario(repository());
    expect(stable(await store.read())).toEqual(stable(await memory.read()));
  });

  it('plans, edits, deletes and purges a trip through the repository', async () => {
    const planner = repository();
    const { userId } = await makeOwner(planner);
    const created = await planner.createTrip(userId, daLatTripInput());
    const tripId = created.trip.id;

    let view = await planner.addActivity(userId, tripId, activityInput(), created.trip.version);
    view = await planner.addActivity(
      userId,
      tripId,
      activityInput({ title: 'Cà phê', startTime: '09:00' }),
      view.trip.version,
    );
    const [first, second] = view.days[0]!.activities.map((a) => a.id);
    view = await planner.reorder(
      userId,
      tripId,
      { op: 'reorder-day', dayNumber: 1, activityIds: [second!, first!] },
      view.trip.version,
    );
    expect(view.days[0]!.activities.map((a) => a.id)).toEqual([second, first]);

    view = await planner.addExpense(
      userId,
      tripId,
      expenseInput({ activityId: first!, amountVnd: 120_000 }),
      view.trip.version,
    );
    view = await planner.deleteActivity(userId, tripId, first!, view.trip.version);
    expect(view.days[0]!.activities.map((a) => a.order)).toEqual([0]);

    // Reload through a second repository over the same database: nothing cached.
    const reloaded = await repository(createPostgresPlannerStore(openPool())).getTrip(userId, tripId);
    expect(reloaded.trip.version).toBe(view.trip.version);
    expect(reloaded.budget.targetTotalVnd).toBe(5_000_000);

    const archived = await planner.archiveTrip(userId, tripId, view.trip.version);
    await planner.purgeTrip(userId, tripId, archived.version);
    const left = await pool.query(
      'SELECT (SELECT count(*) FROM trips) t, (SELECT count(*) FROM trip_days) d, (SELECT count(*) FROM trip_activities) a, (SELECT count(*) FROM trip_expenses) e',
    );
    expect(left.rows[0]).toEqual({ t: '0', d: '0', a: '0', e: '0' });
  });

  describe('foreign keys mirror the repository', () => {
    async function seeded() {
      const planner = repository();
      const { userId } = await makeOwner(planner);
      const created = await planner.createTrip(userId, daLatTripInput());
      let view = await planner.addActivity(userId, created.trip.id, activityInput(), created.trip.version);
      const activityId = view.days[0]!.activities[0]!.id;
      view = await planner.addExpense(
        userId,
        created.trip.id,
        expenseInput({ activityId }),
        view.trip.version,
      );
      return { planner, userId, tripId: created.trip.id, activityId, dayId: view.days[0]!.id };
    }

    it('deleting an activity frees its expense but keeps the expense and its day', async () => {
      const { activityId, dayId } = await seeded();
      await pool.query('DELETE FROM trip_activities WHERE id = $1', [activityId]);
      const expense = await pool.query('SELECT activity_id, day_id FROM trip_expenses');
      expect(expense.rows).toEqual([{ activity_id: null, day_id: dayId }]);
    });

    it('deleting a day that still holds an expense is refused, as dropDays refuses it', async () => {
      const { dayId, planner, userId, tripId } = await seeded();
      await expect(pool.query('DELETE FROM trip_days WHERE id = $1', [dayId])).rejects.toMatchObject({
        code: '23503',
      });
      // And the repository agrees: shortening the trip over a day that still
      // holds an expense is refused (`dropDays`).
      const { trip } = await planner.getTrip(userId, tripId);
      const withLateExpense = await planner.addExpense(
        userId,
        tripId,
        expenseInput({ dayNumber: 3, label: 'Taxi ra sân bay' }),
        trip.version,
      );
      await expect(
        planner.updateTrip(userId, tripId, { durationDays: 2 }, withLateExpense.trip.version),
      ).rejects.toMatchObject({ code: 'invalid_state' });
    });

    it('deleting a trip row removes everything under it', async () => {
      const { tripId } = await seeded();
      await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);
      const left = await pool.query('SELECT count(*) FROM trip_expenses');
      expect(left.rows[0]).toEqual({ count: '0' });
    });

    it('resets an email-less user and signs them in by handle (ADR 0018)', async () => {
      const planner = repository();
      const { user } = await planner.createUser({ handle: 'khong-email-pg', displayName: 'Không email' });
      const reset = await planner.resetUserPassword(user.id);
      const session = await planner.signInWithPassword('khong-email-pg', reset.temporaryPassword);
      expect(session.user.mustChangePassword).toBe(true);
    });

    it('a user who owns a trip cannot be deleted', async () => {
      const { userId } = await seeded();
      await expect(pool.query('DELETE FROM planner_users WHERE id = $1', [userId])).rejects.toMatchObject({
        code: '23503',
      });
    });
  });

  it('commits a reorder that passes through a duplicate order (deferred unique)', async () => {
    const planner = repository();
    const { userId } = await makeOwner(planner);
    const created = await planner.createTrip(userId, daLatTripInput());
    let view = await planner.addActivity(userId, created.trip.id, activityInput(), created.trip.version);
    view = await planner.addActivity(userId, created.trip.id, activityInput({ title: 'Hai' }), view.trip.version);
    view = await planner.addActivity(userId, created.trip.id, activityInput({ title: 'Ba' }), view.trip.version);
    const ids = view.days[0]!.activities.map((a) => a.id);
    view = await planner.reorder(
      userId,
      created.trip.id,
      { op: 'reorder-day', dayNumber: 1, activityIds: [ids[2]!, ids[0]!, ids[1]!] },
      view.trip.version,
    );
    expect(view.days[0]!.activities.map((a) => a.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  describe('concurrency', () => {
    it('two stores (two processes) never lose an update', async () => {
      const a = processLike(createPostgresPlannerStore(openPool()));
      const b = processLike(createPostgresPlannerStore(openPool()));
      await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          (i % 2 ? a : b).createUser({ handle: `nguoi-dung-${i}`, displayName: `Người ${i}` }),
        ),
      );
      expect(await a.listUsers()).toHaveLength(12);
    });

    it('the same handle created from two processes yields one success and one 409', async () => {
      const a = processLike(createPostgresPlannerStore(openPool()));
      const b = processLike(createPostgresPlannerStore(openPool()));
      const results = await Promise.allSettled([
        a.createUser({ handle: 'trung-ten', displayName: 'Một' }),
        b.createUser({ handle: 'trung-ten', displayName: 'Hai' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((failure.reason as ContentError).status).toBe(409);
    });

    it('a write through one store invalidates the cache of another', async () => {
      const a = createPostgresPlannerStore(openPool());
      const b = createPostgresPlannerStore(openPool());
      expect((await a.read()).users).toEqual([]); // A now caches the empty state
      await processLike(b).createUser({ handle: 'nguoi-moi', displayName: 'Người mới' });
      expect((await a.read()).users.map((user) => user.handle)).toEqual(['nguoi-moi']);
      expect(await a.revision!()).toBe(await b.revision!());
    });

    it('a cached store cannot lose an update made by another store', async () => {
      const a = processLike(createPostgresPlannerStore(openPool()));
      const b = processLike(createPostgresPlannerStore(openPool()));
      const { userId } = await makeOwner(a);
      const created = await a.createTrip(userId, daLatTripInput());
      await b.getTrip(userId, created.trip.id); // both caches are warm
      await a.addActivity(userId, created.trip.id, activityInput({ title: 'Từ A' }), created.trip.version);
      // B's cache is behind; its write must be validated against the real state.
      const stale = await b
        .addActivity(userId, created.trip.id, activityInput({ title: 'Từ B' }), created.trip.version)
        .catch((caught: unknown) => caught);
      expect((stale as ContentError).status).toBe(412);
      const { days } = await b.getTrip(userId, created.trip.id);
      expect(days[0]!.activities.map((activity) => activity.title)).toEqual(['Từ A']);
    });

    it('a rolled-back transaction leaves the cache and the revision alone', async () => {
      const revision = await store.revision!();
      await store.read();
      await expect(
        store.transact((data) => {
          data.users.push({
            id: 'usr_r',
            handle: 'roll-back',
            displayName: 'Roll back',
            tokenHash: 'b'.repeat(64),
            createdAt: FROZEN_NOW,
            updatedAt: FROZEN_NOW,
          });
          throw new Error('abandon');
        }),
      ).rejects.toThrow('abandon');
      expect(await store.revision!()).toBe(revision);
      expect((await store.read()).users).toEqual([]);
    });

    it('a cached read equals a cold read of the committed state', async () => {
      await runScenario(repository());
      const warm = await store.read();
      const cold = await createPostgresPlannerStore(openPool()).read();
      expect(warm).toEqual(cold);
    });

    it('a failed transaction leaves nothing behind', async () => {
      await expect(
        store.transact(async (data) => {
          data.users.push({
            id: 'usr_x',
            handle: 'se-bi-huy',
            displayName: 'Sẽ bị huỷ',
            tokenHash: 'a'.repeat(64),
            createdAt: FROZEN_NOW,
            updatedAt: FROZEN_NOW,
          });
          throw new Error('abandon');
        }),
      ).rejects.toThrow('abandon');
      expect((await store.read()).users).toEqual([]);
    });
  });

  it('maps a database unique violation to the existing 409 even when the repository is bypassed', async () => {
    const user = (id: string) => ({
      id,
      handle: 'cung-ten',
      displayName: 'Cùng tên',
      tokenHash: id.padEnd(64, 'f'),
      createdAt: FROZEN_NOW,
      updatedAt: FROZEN_NOW,
    });
    await store.transact((data) => void data.users.push(user('usr_a')));
    const error = (await store
      .transact((data) => void data.users.push(user('usr_b')))
      .catch((caught: unknown) => caught)) as ContentError;
    expect(error).toBeInstanceOf(ContentError);
    expect(error.status).toBe(409);
    expect((await store.read()).users).toHaveLength(1);
  });

  describe('startup migration', () => {
    it('applies each file once when two replicas start together, and lets the app use the schema', async () => {
      const fresh = `pgtest_${randomBytes(6).toString('hex')}`;
      await admin.query(`CREATE SCHEMA ${fresh}`);
      const first = createPostgresPool(url!, { options: `-c search_path=${fresh}`, max: 2 });
      const second = createPostgresPool(url!, { options: `-c search_path=${fresh}`, max: 2 });
      pools.push(first, second);
      try {
        const files = await readMigrationFiles('db/migrations');
        const [one, two] = await Promise.all([
          migrateOnStartup(first),
          migrateOnStartup(second),
        ]);
        const names = files.map((file) => file.name);
        // Exactly one of them applied each file; the other skipped it.
        expect([...one.applied, ...two.applied].sort()).toEqual(names);
        const recorded = await first.query('SELECT name FROM schema_migrations ORDER BY name');
        expect(recorded.rows.map((row) => row.name)).toEqual(names);
        const planner = processLike(createPostgresPlannerStore(first));
        await planner.createUser({ handle: 'moi-khoi-dong', displayName: 'Mới khởi động' });
      } finally {
        await admin.query(`DROP SCHEMA ${fresh} CASCADE`);
      }
    });
  });

  describe('share links across replicas', () => {
    it('a link created through one store resolves through another, and stops when revoked', async () => {
      const a = processLike(createPostgresPlannerStore(openPool()));
      const b = processLike(createPostgresPlannerStore(openPool()));
      const { userId } = await makeOwner(a);
      const created = await a.createTrip(userId, daLatTripInput());
      await a.addActivity(userId, created.trip.id, activityInput(), created.trip.version);

      expect(await b.getSharedTrip('x'.repeat(43))).toBeNull(); // B's index is built, empty
      const { shareToken } = await a.setVisibility(userId, created.trip.id, 'unlisted');
      expect(await b.getSharedTrip(shareToken!)).not.toBeNull();

      await a.revokeShare(userId, created.trip.id);
      expect(await b.getSharedTrip(shareToken!)).toBeNull();
    });
  });

  describe('import and export', () => {
    const options = { catalog: fakeCatalog(), now: () => new Date(FROZEN_NOW) };

    it('imports a document, refuses a second import, and exports it back identically', async () => {
      const source = createMemoryPlannerStore();
      await runScenario(makePlanner({ store: source }));
      const document = await source.read();

      await importPlannerDocument(store, JSON.parse(JSON.stringify(document)), options);
      expect(JSON.parse(await exportPlannerDocument(store))).toEqual(document);

      const again = await importPlannerDocument(store, document, options).catch((e: unknown) => e);
      expect((again as ContentError).code).toBe('invalid_state');
      expect(JSON.parse(await exportPlannerDocument(store))).toEqual(document);
    });

    it('an import with an invalid file writes nothing', async () => {
      const bad = { trips: [{ id: 'trip_1' }] };
      await expect(importPlannerDocument(store, bad, options)).rejects.toBeInstanceOf(ContentError);
      expect((await store.read()).trips).toEqual([]);
    });
  });
});
