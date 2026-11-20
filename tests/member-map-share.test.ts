import { describe, expect, it } from 'vitest';
import { ContentError } from '../src/server/content/errors';
import {
  buildPublicMemberMapPoints,
  isDisplayNameSuitable,
  mapShareDigest,
  newMapShareToken,
  visitsBucket,
} from '../src/server/planner/member-map-share';
import { PlannerRepository } from '../src/server/planner/repository';
import { SHARE_TOKEN_PATTERN } from '../src/server/planner/schemas';
import { createMemoryPlannerStore, type PlannerStore } from '../src/server/planner/store';
import {
  exportPlannerDocument,
  importPlannerDocument,
} from '../src/server/persistence/planner-transfer';
import { daLatTripInput, fakeCatalog, FROZEN_NOW, makePlanner } from './planner-helpers';

/** ADR 0030 slice 2a: the store, the token, the public projection, lifecycle and transfer. */

async function refusal(promise: Promise<unknown>): Promise<ContentError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ContentError) return error;
    throw error;
  }
  throw new Error('expected a refusal, but it resolved');
}

function setup(nameAvailable = false) {
  const store = createMemoryPlannerStore();
  const planner = new PlannerRepository({
    store,
    catalog: fakeCatalog(),
    now: () => new Date(FROZEN_NOW),
    scryptCostLog2: 10,
    mapShareNameAvailable: nameAvailable,
  });
  return { planner, store };
}

async function member(planner: PlannerRepository, handle: string, displayName = 'Người dùng') {
  return (await planner.createUser({ handle, displayName, role: 'member' })).user.id;
}

/** A trip that is `completed`, in `destinationSlug`. */
async function completedTrip(planner: PlannerRepository, ownerId: string, destinationSlug = 'da-lat') {
  const view = await planner.createTrip(ownerId, daLatTripInput({ destinationSlug }));
  const updated = await planner.updateTrip(ownerId, view.trip.id, { planningStatus: 'completed' }, view.trip.version);
  return updated.trip;
}

describe('pure helpers', () => {
  it('buckets visits as 1 / 2–3 / 4 or more', () => {
    expect([1, 2, 3, 4, 9].map(visitsBucket)).toEqual([1, 2, 2, 3, 3]);
  });

  it('issues a 43-character token and stores only a 64-hex digest', () => {
    const token = newMapShareToken();
    expect(token).toMatch(SHARE_TOKEN_PATTERN);
    expect(newMapShareToken()).not.toBe(token);
    expect(mapShareDigest(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(mapShareDigest(token)).not.toContain(token);
  });

  it('rejects a display name that looks like an email or a phone number', () => {
    expect(isDisplayNameSuitable('Hưng Đoàn')).toBe(true);
    expect(isDisplayNameSuitable('Phòng 301 Hà Nội')).toBe(true);
    expect(isDisplayNameSuitable('hung@example.com')).toBe(false);
    expect(isDisplayNameSuitable('0912 345 678')).toBe(false);
    expect(isDisplayNameSuitable('+84-912-345-678')).toBe(false);
  });

  it('projects only completed trips of the owner, sorted by slug, with exactly the allow-listed keys', () => {
    const trips = [
      { ownerId: 'a', destinationSlug: 'moc-chau', planningStatus: 'completed' as const },
      { ownerId: 'a', destinationSlug: 'da-lat', planningStatus: 'completed' as const },
      { ownerId: 'a', destinationSlug: 'da-lat', planningStatus: 'completed' as const },
      { ownerId: 'a', destinationSlug: 'ha-giang', planningStatus: 'planned' as const },
      { ownerId: 'a', destinationSlug: 'sa-pa', planningStatus: 'draft' as const },
      { ownerId: 'a', destinationSlug: 'unknown', planningStatus: 'completed' as const },
      { ownerId: 'b', destinationSlug: 'hue', planningStatus: 'completed' as const },
    ];
    const points = buildPublicMemberMapPoints(trips, 'a', (slug) => slug !== 'unknown');
    expect(points).toEqual([
      { slug: 'da-lat', visitsBucket: 2 },
      { slug: 'moc-chau', visitsBucket: 1 },
    ]);
    for (const point of points) expect(Object.keys(point).sort()).toEqual(['slug', 'visitsBucket']);
  });
});

describe('owner operations', () => {
  it('reads as not shared and anonymous when there is no row, and never returns a token', async () => {
    const { planner, store } = setup();
    const id = await member(planner, 'ms-a');
    expect(await planner.getMemberMapShare(id)).toEqual({ enabled: false, shareName: 'anonymous', visitedPlaces: 0, sparse: true });
    expect((await store.read()).memberMapShares).toEqual([]);
  });

  it('issues the token once, keeps it on a repeat, and stores only the digest', async () => {
    const { planner, store } = setup();
    const id = await member(planner, 'ms-b');
    const first = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    expect(first.token).toMatch(SHARE_TOKEN_PATTERN);
    expect(first.enabled).toBe(true);
    const again = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    expect(again.token).toBeUndefined();
    expect(again.enabled).toBe(true);
    const rows = (await store.read()).memberMapShares;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenDigest).toBe(mapShareDigest(first.token ?? ''));
    expect(JSON.stringify(await store.read())).not.toContain(first.token ?? 'x');
    expect(await planner.getMemberMapShare(id)).not.toHaveProperty('token');
    // The link works until revoked.
    expect(await planner.getSharedMemberMap(first.token ?? '')).toEqual({ displayName: null, points: [] });
  });

  it('rotates: the old link dies in the same step, the new one works and is returned once', async () => {
    const { planner } = setup();
    const id = await member(planner, 'ms-c');
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    const rotated = await planner.rotateMemberMapShare(id);
    expect(rotated.token).not.toBe(issued.token);
    expect(await planner.getSharedMemberMap(issued.token ?? '')).toBeNull();
    expect(await planner.getSharedMemberMap(rotated.token)).not.toBeNull();
  });

  it('refuses to rotate a map that is not shared', async () => {
    const { planner } = setup();
    const id = await member(planner, 'ms-d');
    const error = await refusal(planner.rotateMemberMapShare(id));
    expect(error.code).toBe('invalid_state');
    expect(error.reason).toBe('not_shared');
  });

  it('revokes at once, repeats without error, and a later enable issues a different token', async () => {
    const { planner, store } = setup();
    const id = await member(planner, 'ms-e');
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    await planner.revokeMemberMapShare(id);
    expect(await planner.getSharedMemberMap(issued.token ?? '')).toBeNull();
    const before = (await store.read()).auditEvents.length;
    expect((await planner.revokeMemberMapShare(id)).enabled).toBe(false);
    expect((await store.read()).auditEvents).toHaveLength(before);
    const second = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    expect(second.token).not.toBe(issued.token);
    expect(await planner.getSharedMemberMap(issued.token ?? '')).toBeNull();
  });

  it('warns on fewer than 2 visited places and counts only completed trips', async () => {
    const { planner } = setup();
    const id = await member(planner, 'ms-f');
    await planner.createTrip(id, daLatTripInput());
    expect(await planner.getMemberMapShare(id)).toMatchObject({ visitedPlaces: 0, sparse: true });
    await completedTrip(planner, id, 'da-lat');
    expect(await planner.getMemberMapShare(id)).toMatchObject({ visitedPlaces: 1, sparse: true });
    await completedTrip(planner, id, 'moc-chau');
    expect(await planner.getMemberMapShare(id)).toMatchObject({ visitedPlaces: 2, sparse: false });
  });

  it('refuses `name` until it is available (403 share_name_unavailable) and writes nothing', async () => {
    const { planner, store } = setup(false);
    const id = await member(planner, 'ms-g');
    const error = await refusal(planner.setMemberMapShare(id, { enabled: true, shareName: 'name' }));
    expect(error.code).toBe('forbidden');
    expect(error.reason).toBe('share_name_unavailable');
    expect((await store.read()).memberMapShares).toEqual([]);
  });

  it('with `name` open: refuses an email or phone display name (422), allows a plain one, reads it fresh', async () => {
    const { planner } = setup(true);
    const bad = await member(planner, 'ms-h', 'hung@example.com');
    const error = await refusal(planner.setMemberMapShare(bad, { enabled: true, shareName: 'name' }));
    expect(error.code).toBe('validation_failed');
    expect(error.reason).toBe('display_name_unsuitable');

    const id = await member(planner, 'ms-i', 'Hưng Đoàn');
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'name' });
    expect((await planner.getSharedMemberMap(issued.token ?? ''))?.displayName).toBe('Hưng Đoàn');
    // Back to anonymous: the name is gone from the view at once.
    await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    expect((await planner.getSharedMemberMap(issued.token ?? ''))?.displayName).toBeNull();
  });
});

describe('the public view', () => {
  it('answers null for every failure alike: malformed, unknown, revoked, not shared', async () => {
    const { planner } = setup();
    const id = await member(planner, 'pv-a');
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    await planner.revokeMemberMapShare(id);
    for (const token of ['', 'short', 'x'.repeat(44), `${'a'.repeat(42)}!`, newMapShareToken(), issued.token ?? '']) {
      expect(await planner.getSharedMemberMap(token)).toBeNull();
    }
    expect(await planner.getSharedMemberMap(undefined as unknown as string)).toBeNull();
  });

  it('shows completed trips only (archived-completed stays), a deleted trip disappears at once', async () => {
    const { planner, store } = setup();
    const id = await member(planner, 'pv-b');
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    const token = issued.token ?? '';
    await planner.createTrip(id, daLatTripInput({ destinationSlug: 'moc-chau' })); // draft: not shown
    const done = await completedTrip(planner, id, 'da-lat');
    expect((await planner.getSharedMemberMap(token))?.points).toEqual([{ slug: 'da-lat', visitsBucket: 1 }]);
    await planner.archiveTrip(id, done.id, done.version);
    expect((await planner.getSharedMemberMap(token))?.points).toEqual([{ slug: 'da-lat', visitsBucket: 1 }]);
    await store.transact((data) => {
      data.trips = data.trips.filter((trip) => trip.id !== done.id);
    });
    expect((await planner.getSharedMemberMap(token))?.points).toEqual([]);
  });

  it('is an allow-list: the serialised view holds only displayName, slug and visitsBucket', async () => {
    const { planner } = setup();
    const id = await member(planner, 'pv-c', 'Tên riêng');
    await completedTrip(planner, id);
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    const view = await planner.getSharedMemberMap(issued.token ?? '');
    expect(Object.keys(view ?? {}).sort()).toEqual(['displayName', 'points']);
    expect(JSON.parse(JSON.stringify(view))).toEqual({ displayName: null, points: [{ slug: 'da-lat', visitsBucket: 1 }] });
    const text = JSON.stringify(view);
    for (const secret of ['Tên riêng', id, 'Đà Lạt', 'trip_', issued.token ?? 'x']) expect(text).not.toContain(secret);
  });

  it('isolates two members: A’s token never shows B, and B cannot change A', async () => {
    const { planner } = setup();
    const a = await member(planner, 'iso-a');
    const b = await member(planner, 'iso-b');
    await completedTrip(planner, a, 'da-lat');
    await completedTrip(planner, b, 'moc-chau');
    const tokenA = (await planner.setMemberMapShare(a, { enabled: true, shareName: 'anonymous' })).token ?? '';
    const tokenB = (await planner.setMemberMapShare(b, { enabled: true, shareName: 'anonymous' })).token ?? '';
    expect((await planner.getSharedMemberMap(tokenA))?.points.map((p) => p.slug)).toEqual(['da-lat']);
    expect((await planner.getSharedMemberMap(tokenB))?.points.map((p) => p.slug)).toEqual(['moc-chau']);
    await planner.revokeMemberMapShare(b);
    await planner.rotateMemberMapShare(b).catch(() => undefined);
    expect(await planner.getSharedMemberMap(tokenA)).not.toBeNull();
    expect((await planner.getMemberMapShare(a)).enabled).toBe(true);
  });

  it('answers null for a banned or soft-deleted owner; a restore revives the same link', async () => {
    const { planner } = setup();
    const admin = (await planner.createUser({ handle: 'pv-admin', displayName: 'Quản trị', role: 'super_admin' })).user.id;
    const other = (await planner.createUser({ handle: 'pv-admin2', displayName: 'Quản trị 2', role: 'super_admin' })).user.id;
    expect(other).not.toBe(admin);
    const id = await member(planner, 'pv-d');
    const token = (await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' })).token ?? '';
    for (const [off, on] of [['ban', 'unban'], ['delete', 'restore']] as const) {
      await planner.changeAccountState(id, off, { userId: admin });
      expect(await planner.getSharedMemberMap(token)).toBeNull();
      await planner.changeAccountState(id, on, { userId: admin });
      expect(await planner.getSharedMemberMap(token)).not.toBeNull();
    }
  });
});

describe('lifecycle, audit and transfer', () => {
  it('deleteUser removes the share row and the link answers null', async () => {
    const { planner, store } = setup();
    const id = await member(planner, 'lc-a');
    const token = (await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' })).token ?? '';
    await planner.deleteUser(id);
    expect((await store.read()).memberMapShares).toEqual([]);
    expect(await planner.getSharedMemberMap(token)).toBeNull();
  });

  it('audits on/rotate/off on the user with no token and no name in any row', async () => {
    const { planner, store } = setup(true);
    const id = await member(planner, 'lc-b', 'Hưng Đoàn');
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'name' });
    const rotated = await planner.rotateMemberMapShare(id);
    await planner.revokeMemberMapShare(id);
    const rows = (await store.read()).auditEvents.filter((event) => event.action.startsWith('map_share'));
    expect(rows.map((row) => row.action)).toEqual(['map_share_name', 'map_share_on', 'map_share_rotate', 'map_share_off']);
    for (const row of rows) {
      expect(row).toMatchObject({ targetKind: 'user', targetId: id, actorId: id });
    }
    const text = JSON.stringify(rows);
    for (const secret of [issued.token ?? 'x', rotated.token, mapShareDigest(rotated.token), 'Hưng Đoàn']) {
      expect(text).not.toContain(secret);
    }
  });

  it('exports without the digest and an import never turns sharing on', async () => {
    const { planner, store } = setup(true);
    const id = await member(planner, 'lc-c');
    const issued = await planner.setMemberMapShare(id, { enabled: true, shareName: 'anonymous' });
    const file = await exportPlannerDocument(store);
    expect(file).not.toContain(mapShareDigest(issued.token ?? ''));
    expect(file).not.toContain(issued.token ?? 'x');

    // A hand-edited file that carries a digest and `name` is neutralised on import.
    const raw = JSON.parse(file) as { memberMapShares: Array<Record<string, unknown>> };
    raw.memberMapShares = raw.memberMapShares.map((row) => ({ ...row, tokenDigest: mapShareDigest(issued.token ?? ''), shareName: 'name' }));
    const target: PlannerStore = createMemoryPlannerStore();
    await importPlannerDocument(target, raw, { catalog: fakeCatalog(), now: () => new Date(FROZEN_NOW) });
    const imported = (await target.read()).memberMapShares;
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ userId: id, tokenDigest: null, shareName: 'anonymous' });
    const after = makePlanner({ store: target });
    expect(await after.getSharedMemberMap(issued.token ?? '')).toBeNull();
  });

  it('reads an older file without the key as nobody sharing', async () => {
    const { planner, store } = setup();
    await member(planner, 'lc-d');
    const old = JSON.parse(await exportPlannerDocument(store)) as Record<string, unknown>;
    delete old.memberMapShares;
    const target = createMemoryPlannerStore();
    await importPlannerDocument(target, old, { catalog: fakeCatalog(), now: () => new Date(FROZEN_NOW) });
    expect((await target.read()).memberMapShares).toEqual([]);
  });
});
