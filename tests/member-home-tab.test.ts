import { describe, expect, it } from 'vitest';
import { DEFAULT_MEMBER_HOME_TAB, MEMBER_HOME_TABS, parseMemberHomeTab } from '../src/lib/member-home-tab';
import { resolveMemberSession } from '../src/server/planner/member-map';
import { resolveMemberMapShareOverview } from '../src/server/planner/member-map-share-preview';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import type { PlannerRepository } from '../src/server/planner/repository';
import { daLatTripInput, makeOwner, makePlanner } from './planner-helpers';

/** ADR 0032: the member home's tab is a server-read query, and each tab reads only its own data. */

describe('parseMemberHomeTab', () => {
  it('accepts exactly the three known tabs and defaults to the map', () => {
    for (const tab of MEMBER_HOME_TABS) expect(parseMemberHomeTab(tab)).toBe(tab);
    expect(DEFAULT_MEMBER_HOME_TAB).toBe('map');
    for (const raw of [undefined, '', 'MAP', 'trips ', '<script>', '__proto__', 'archived']) {
      expect(parseMemberHomeTab(raw)).toBe('map');
    }
  });

  it('uses the first value of a repeated parameter', () => {
    expect(parseMemberHomeTab(['share', 'trips'])).toBe('share');
    expect(parseMemberHomeTab(['nope', 'share'])).toBe('map');
  });
});

describe('resolveMemberSession', () => {
  it('is false for a guest or a malformed cookie without touching the store', async () => {
    let reads = 0;
    const spy = new Proxy({} as PlannerRepository, {
      get: () => () => {
        reads += 1;
        throw new Error('store touched');
      },
    });
    for (const cookie of [null, '', 'garbage!', 'short']) {
      expect(await resolveMemberSession(spy, cookie)).toBe(false);
    }
    expect(reads).toBe(0);
  });

  it('is true for a live session, false for a forged one, and never reads trips', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const { token } = await makeOwner(planner, 'thanh-vien');
    const cookie = (await planner.signIn(token)).token;
    const identifyOnly = { identify: planner.identify.bind(planner) };
    expect(await resolveMemberSession(identifyOnly, cookie)).toBe(true);
    expect(await resolveMemberSession(identifyOnly, 'A'.repeat(43))).toBe(false);
  });
});

describe('resolveMemberMapShareOverview', () => {
  it('counts active trips that are not completed, as a number only', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const { userId, token } = await makeOwner(planner, 'nguoi-di');
    const cookie = (await planner.signIn(token)).token;
    const done = await planner.createTrip(userId, daLatTripInput({ destinationSlug: 'da-lat' }));
    await planner.updateTrip(userId, done.trip.id, { planningStatus: 'completed' }, done.trip.version);
    await planner.createTrip(userId, daLatTripInput({ destinationSlug: 'moc-chau' }));
    await planner.createTrip(userId, daLatTripInput({ destinationSlug: 'moc-chau' }));
    const overview = await resolveMemberMapShareOverview(planner, cookie, new Set(['da-lat', 'moc-chau']));
    expect(overview?.unfinishedTrips).toBe(2);
    expect(overview?.points).toEqual([{ slug: 'da-lat', visitsBucket: 1 }]);
    expect(Object.keys(overview ?? {}).sort()).toEqual(['points', 'unfinishedTrips']);
  });

  it('is null for a guest', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    expect(await resolveMemberMapShareOverview(planner, null, new Set(['da-lat']))).toBeNull();
  });
});
