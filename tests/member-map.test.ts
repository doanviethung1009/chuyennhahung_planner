import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memberMapPaths } from '../next.config';
import { buildMemberMapPoints, resolveMemberMap } from '../src/server/planner/member-map';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import type { PlannerRepository } from '../src/server/planner/repository';
import { daLatTripInput, makeOwner, makePlanner } from './planner-helpers';

/**
 * The member map's rule and its privacy boundary (ADR 0029): which points a
 * member gets, that nobody else's reach them, and that a guest gets nothing.
 */

const KNOWN = new Set(['da-lat', 'moc-chau', 'hue']);
const PLACES = new Map([
  ['ho-xuan-huong', 'da-lat'],
  ['doi-che-moc-chau', 'moc-chau'],
  ['dai-noi-hue', 'hue'],
  ['cho-la', 'khong-co-trong-seed'],
]);

const trip = (
  destinationSlug: string,
  status: 'active' | 'archived',
  planningStatus: 'draft' | 'planned' | 'completed',
  startDate: string | null = null,
  endDate: string | null = null,
) => ({ destinationSlug, status, planningStatus, startDate, endDate });
const review = (placeSlug: string, visitedOn: string, status: 'approved' | 'rejected' = 'approved') => ({
  placeSlug,
  visitedOn,
  status,
});

describe('buildMemberMapPoints', () => {
  it('draws a completed trip solid and a draft or planned active trip hollow', () => {
    const points = buildMemberMapPoints(
      [trip('da-lat', 'active', 'completed'), trip('moc-chau', 'active', 'planned'), trip('hue', 'active', 'draft')],
      [],
      PLACES,
      KNOWN,
    );
    expect(points).toEqual([{ slug: 'da-lat', visits: 1 }, { slug: 'hue' }, { slug: 'moc-chau' }]);
  });

  it('keeps an archived completed trip as visited and drops an archived unfinished one', () => {
    const points = buildMemberMapPoints(
      [trip('da-lat', 'archived', 'completed'), trip('moc-chau', 'archived', 'planned'), trip('hue', 'archived', 'draft')],
      [],
      PLACES,
      KNOWN,
    );
    expect(points).toEqual([{ slug: 'da-lat', visits: 1 }]);
  });

  it('lets visited win when a destination is both visited and planned', () => {
    const points = buildMemberMapPoints(
      [trip('da-lat', 'active', 'planned'), trip('da-lat', 'archived', 'completed')],
      [],
      PLACES,
      KNOWN,
    );
    expect(points).toEqual([{ slug: 'da-lat', visits: 1 }]);
  });

  it('counts a review visit, but never twice for one day or for a day inside a completed trip', () => {
    const points = buildMemberMapPoints(
      [trip('da-lat', 'active', 'completed', '2026-04-10', '2026-04-12')],
      [
        review('ho-xuan-huong', '2026-04-11'), // inside the trip: same journey
        review('ho-xuan-huong', '2026-08-01'),
        review('ho-xuan-huong', '2026-08-01'), // same day twice
        review('doi-che-moc-chau', '2026-05-05'),
        review('doi-che-moc-chau', '2026-05-05', 'rejected'), // moderated away
      ],
      PLACES,
      KNOWN,
    );
    expect(points).toEqual([
      { slug: 'da-lat', visits: 2 },
      { slug: 'moc-chau', visits: 1 },
    ]);
  });

  it('puts a planned trip under a visit from a review as solid', () => {
    expect(
      buildMemberMapPoints([trip('moc-chau', 'active', 'planned')], [review('doi-che-moc-chau', '2026-05-05')], PLACES, KNOWN),
    ).toEqual([{ slug: 'moc-chau', visits: 1 }]);
  });

  it('drops destinations the seed does not know, and places with no destination', () => {
    expect(
      buildMemberMapPoints(
        [trip('atlantis', 'active', 'completed')],
        [review('cho-la', '2026-05-05'), review('khong-co-place', '2026-05-05')],
        PLACES,
        KNOWN,
      ),
    ).toEqual([]);
  });
});

async function session(planner: PlannerRepository, handle: string) {
  const { userId, token } = await makeOwner(planner, handle);
  return { userId, cookie: (await planner.signIn(token)).token, token };
}

describe('resolveMemberMap', () => {
  it('is a guest without a cookie, with a garbage one, an unknown one, or a bearer token', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const { token } = await session(planner, 'khach');
    for (const cookie of [null, '', 'garbage', 'A'.repeat(43), token]) {
      expect(await resolveMemberMap(planner, cookie, PLACES, KNOWN)).toEqual({ status: 'guest' });
    }
  });

  it('does not read the store for a malformed cookie', async () => {
    let reads = 0;
    const spy = new Proxy({} as PlannerRepository, {
      get: () => () => {
        reads += 1;
        throw new Error('store touched');
      },
    });
    expect(await resolveMemberMap(spy, 'not a token!', PLACES, KNOWN)).toEqual({ status: 'guest' });
    expect(reads).toBe(0);
  });

  it('is a guest while a password change is pending', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const { temporaryPassword } = await planner.createUser({ handle: 'tam', displayName: 'Tâm', email: 'tam@example.com' });
    const signed = await planner.signInWithPassword('tam@example.com', temporaryPassword!);
    expect(await resolveMemberMap(planner, signed.token, PLACES, KNOWN)).toEqual({ status: 'guest' });
  });

  it('is empty for a member with no trip or visit', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const { cookie } = await session(planner, 'moi');
    expect(await resolveMemberMap(planner, cookie, PLACES, KNOWN)).toEqual({ status: 'empty' });
  });

  it('never shows one member another member’s trips or reviews', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const a = await session(planner, 'a-thanh');
    const b = await session(planner, 'b-lan');

    const aTrip = await planner.createTrip(a.userId, daLatTripInput({ title: 'Bí mật của A' }));
    await planner.updateTrip(a.userId, aTrip.trip.id, { planningStatus: 'completed' }, aTrip.trip.version);
    await planner.createTrip(b.userId, daLatTripInput({ destinationSlug: 'moc-chau', title: 'Chuyến của B' }));
    await planner.upsertPlannerReview(b.userId, 'doi-che-moc-chau', {
      rating: 5,
      body: 'Đồi chè rất đẹp vào buổi sáng, sương còn đọng, nên đi sớm để chụp ảnh và uống trà.',
      lang: 'vi',
      visitedOn: '2024-05-05',
      authorDisplay: 'name',
    });

    expect(await resolveMemberMap(planner, a.cookie, PLACES, KNOWN)).toEqual({
      status: 'ready',
      points: [{ slug: 'da-lat', visits: 1 }],
    });
    expect(await resolveMemberMap(planner, b.cookie, PLACES, KNOWN)).toEqual({
      status: 'ready',
      points: [{ slug: 'moc-chau', visits: 1 }],
    });
  });

  it('hands the component only the allow-listed keys, with no trip text or owner', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const a = await session(planner, 'a-thanh');
    const made = await planner.createTrip(a.userId, daLatTripInput({ title: 'Bí mật của A' }));
    await planner.updateTrip(a.userId, made.trip.id, { planningStatus: 'completed' }, made.trip.version);
    await planner.createTrip(a.userId, daLatTripInput({ destinationSlug: 'moc-chau' }));

    const state = await resolveMemberMap(planner, a.cookie, PLACES, KNOWN);
    expect(Object.keys(state).sort()).toEqual(['points', 'status']);
    if (state.status !== 'ready') throw new Error('expected ready');
    for (const point of state.points) {
      expect(Object.keys(point).every((key) => key === 'slug' || key === 'visits')).toBe(true);
    }
    const json = JSON.stringify(state);
    for (const secret of [a.userId, made.trip.id, 'Bí mật của A', 'ownerId', 'shareToken']) {
      expect(json).not.toContain(secret);
    }
  });

  it('counts a completed trip that was archived afterwards', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const a = await session(planner, 'a-thanh');
    const made = await planner.createTrip(a.userId, daLatTripInput());
    const done = await planner.updateTrip(a.userId, made.trip.id, { planningStatus: 'completed' }, made.trip.version);
    await planner.archiveTrip(a.userId, made.trip.id, done.trip.version);
    expect(await resolveMemberMap(planner, a.cookie, PLACES, KNOWN)).toEqual({
      status: 'ready',
      points: [{ slug: 'da-lat', visits: 1 }],
    });
  });
});

describe('the /my-map boundary (ADR 0029)', () => {
  const src = resolve(import.meta.dirname, '../src');
  const read = (path: string) => readFileSync(resolve(src, path), 'utf8');

  it('answers the member map private, no-store on both locales', async () => {
    const nextConfig = (await import('../next.config')).default;
    const rules = (await nextConfig.headers?.()) ?? [];
    for (const path of memberMapPaths) {
      const rule = rules.find((r) => r.source === path);
      expect(rule?.headers).toContainEqual({ key: 'Cache-Control', value: 'private, no-store' });
    }
    expect(memberMapPaths).toEqual(['/ban-do-cua-toi', '/en/my-map']);
  });

  it('keeps the page noindex and dynamic, and /map free of member data', () => {
    const page = read('app/[locale]/my-map/page.tsx');
    expect(page).toMatch(/index: false/);
    expect(page).toMatch(/force-dynamic/);
    expect(read('app/[locale]/map/page.tsx')).not.toMatch(/member-map|getMemberMap|cookies/);
    expect(read('components/map/member-map-view.tsx')).toMatch(/^import type \{ MemberMapState \}/m);
  });
});
