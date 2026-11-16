import { describe, expect, it, vi } from 'vitest';
import { resolveHomeMember } from '../src/server/planner/home-page';
import type { PlannerRepository } from '../src/server/planner/repository';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { daLatTripInput, makeOwner, makePlanner } from './planner-helpers';

/**
 * The home page's view of the visitor (ADR 0022, docs/specs-home-mvp.md),
 * against a real in-memory Planner so identity and ownership are the real ones.
 */

const NOW = new Date('2026-06-10T03:00:00Z'); // 10 June in Vietnam

async function setup() {
  const planner = makePlanner({ store: createMemoryPlannerStore() });
  return planner;
}

async function member(planner: PlannerRepository, handle: string) {
  const { userId, token } = await makeOwner(planner, handle);
  const session = await planner.signIn(token);
  return { userId, cookie: session.token };
}

describe('resolveHomeMember', () => {
  it('is a guest without a cookie or with a garbage one', async () => {
    const planner = await setup();
    expect(await resolveHomeMember(planner, null, NOW)).toEqual({ status: 'guest' });
    expect(await resolveHomeMember(planner, 'not-a-real-session', NOW)).toEqual({ status: 'guest' });
    // Well-formed but unknown: reaches the store and is refused there.
    expect(await resolveHomeMember(planner, 'A'.repeat(43), NOW)).toEqual({ status: 'guest' });
  });

  it('is a guest when a bearer-only identity is all there is', async () => {
    const planner = await setup();
    const { token } = await makeOwner(planner, 'bearer-only');
    // An access token is not a session cookie: it must not open the member band.
    expect(await resolveHomeMember(planner, token, NOW)).toEqual({ status: 'guest' });
  });

  it('is a guest while a password change is pending', async () => {
    const planner = await setup();
    const { temporaryPassword } = await planner.createUser({
      handle: 'tam',
      displayName: 'Tâm',
      email: 'tam@example.com',
    });
    const session = await planner.signInWithPassword('tam@example.com', temporaryPassword!);
    expect(session.user.mustChangePassword).toBe(true);
    expect(await resolveHomeMember(planner, session.token, NOW)).toEqual({ status: 'guest' });
  });

  it('asks a member with no trips at all to create the first one', async () => {
    const planner = await setup();
    const { cookie } = await member(planner, 'moi');
    expect(await resolveHomeMember(planner, cookie, NOW)).toEqual({ status: 'first-trip' });
  });

  it('offers a next trip when every trip is archived', async () => {
    const planner = await setup();
    const { userId, cookie } = await member(planner, 'cat-di');
    const view = await planner.createTrip(userId, daLatTripInput());
    await planner.archiveTrip(userId, view.trip.id, view.trip.version);
    expect(await resolveHomeMember(planner, cookie, NOW)).toEqual({ status: 'next-trip' });
  });

  it('offers a next trip when every active trip is completed', async () => {
    const planner = await setup();
    const { userId, cookie } = await member(planner, 'di-xong');
    const view = await planner.createTrip(userId, daLatTripInput());
    await planner.updateTrip(userId, view.trip.id, { planningStatus: 'completed' }, view.trip.version);
    expect(await resolveHomeMember(planner, cookie, NOW)).toEqual({ status: 'next-trip' });
  });

  it('continues the upcoming trip, exposing only the allow-listed fields', async () => {
    const planner = await setup();
    const { userId, cookie } = await member(planner, 'dang-lam');
    await planner.createTrip(userId, daLatTripInput({ title: 'Đà Lạt xa', startDate: '2026-09-01' }));
    const soon = await planner.createTrip(
      userId,
      daLatTripInput({ title: 'Đà Lạt gần', startDate: '2026-06-22', note: 'ghi chú riêng' }),
    );

    const result = await resolveHomeMember(planner, cookie, NOW);
    expect(result.status).toBe('continue');
    if (result.status !== 'continue') return;

    expect(result.trip).toEqual({
      id: soon.trip.id,
      title: 'Đà Lạt gần',
      destinationSlug: 'da-lat',
      durationDays: 3,
      startDate: '2026-06-22',
      daysUntilStart: 12,
      planningStatus: 'draft',
    });
    // Nothing private can ride along: the exact key set is the contract.
    expect(Object.keys(result.trip).sort()).toEqual(
      [
        'daysUntilStart',
        'destinationSlug',
        'durationDays',
        'id',
        'planningStatus',
        'startDate',
        'title',
      ].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(/ghi chú riêng|ownerId|shareToken|budget|version/);
  });

  it('reads today in Vietnam across the UTC midnight boundary', async () => {
    const planner = await setup();
    const { userId, cookie } = await member(planner, 'nua-dem');
    await planner.createTrip(userId, daLatTripInput({ startDate: '2026-06-10' }));

    // 18:30 UTC on 9 June is 10 June in Vietnam: the trip leaves today.
    expect(await resolveHomeMember(planner, cookie, new Date('2026-06-09T18:30:00Z'))).toMatchObject({
      status: 'continue',
      trip: { daysUntilStart: 0 },
    });
    // 16:59 UTC is still 9 June in Vietnam: one day to go.
    expect(await resolveHomeMember(planner, cookie, new Date('2026-06-09T16:59:00Z'))).toMatchObject({
      status: 'continue',
      trip: { daysUntilStart: 1 },
    });
  });

  it('turns a malformed cookie away without touching the store', async () => {
    const spy = {
      identify: vi.fn(() => Promise.reject(new Error('must not be called'))),
      listTrips: vi.fn(() => Promise.reject(new Error('must not be called'))),
    };
    for (const junk of ['garbage', 'a'.repeat(31), 'a'.repeat(129), `${'a'.repeat(40)} x`, '"><script>']) {
      expect(await resolveHomeMember(spy, junk, NOW)).toEqual({ status: 'guest' });
    }
    expect(spy.identify).not.toHaveBeenCalled();
    expect(spy.listTrips).not.toHaveBeenCalled();
  });

  it('accepts a real session token shape, so the filter never locks members out', async () => {
    const planner = await setup();
    const { cookie } = await member(planner, 'hinh-dang');
    expect(cookie).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  });

  it('reports no countdown for a trip whose date has passed', async () => {
    const planner = await setup();
    const { userId, cookie } = await member(planner, 'da-qua');
    await planner.createTrip(userId, daLatTripInput({ startDate: '2026-06-01' }));
    const result = await resolveHomeMember(planner, cookie, NOW);
    expect(result).toMatchObject({ status: 'continue', trip: { daysUntilStart: null } });
  });

  it('never shows one member another member’s trip', async () => {
    const planner = await setup();
    const a = await member(planner, 'an');
    const b = await member(planner, 'binh');
    await planner.createTrip(b.userId, daLatTripInput({ title: 'Chuyến riêng của Bình' }));

    expect(await resolveHomeMember(planner, a.cookie, NOW)).toEqual({ status: 'first-trip' });
    const seenByB = await resolveHomeMember(planner, b.cookie, NOW);
    expect(JSON.stringify(seenByB)).toContain('Chuyến riêng của Bình');
  });

  it('falls back to a guest when the store fails, without leaking the error', async () => {
    const planner = await setup();
    const { cookie } = await member(planner, 'loi-store');
    const broken = {
      identify: planner.identify.bind(planner),
      listTrips: () => Promise.reject(new Error('boom with secret-detail')),
    };
    expect(await resolveHomeMember(broken, cookie, NOW)).toEqual({ status: 'guest' });
  });
});
