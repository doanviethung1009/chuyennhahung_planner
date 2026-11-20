import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import nextConfig, { mapSharePaths } from '../next.config';
import robots from '../src/app/robots';
import sitemap from '../src/app/sitemap';
import { pathnames } from '../src/i18n/routing';
import { PlannerRepository } from '../src/server/planner/repository';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { daLatTripInput, fakeCatalog, FROZEN_NOW } from './planner-helpers';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

/** ADR 0030 slice 2b: the public page `/shared-map/[token]`. */

let planner: PlannerRepository;
let store: ReturnType<typeof createMemoryPlannerStore>;
vi.mock('../src/server/planner/instance', () => ({ getPlannerRepository: async () => planner }));
// Imported after the mock so the page module sees the fake repository.
const { loadSharedMemberMap, sharedMapDestinations } = await import('../src/server/planner/shared-map-page');

const KNOWN = ['ha-giang', 'sa-pa'];
const headers = (ip: string) => ({ get: (n: string) => (n.toLowerCase() === 'x-forwarded-for' ? ip : null) });
const read = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8');
let ipSeq = 0;
const freshHeaders = () => headers(`10.1.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`);

async function setup() {
  store = createMemoryPlannerStore();
  planner = new PlannerRepository({
    store,
    catalog: fakeCatalog({ hasDestination: (s) => KNOWN.includes(s) }),
    now: () => new Date(FROZEN_NOW),
    scryptCostLog2: 10,
  });
  const user = (await planner.createUser({ handle: 'a', displayName: 'Tên Bí Mật', role: 'member' })).user.id;
  return user;
}

async function trip(owner: string, slug: string, status: 'completed' | 'planned' | 'draft', archive = false) {
  const v = await planner.createTrip(owner, daLatTripInput({ destinationSlug: slug }));
  const u = await planner.updateTrip(owner, v.trip.id, { planningStatus: status }, v.trip.version);
  if (archive) await planner.archiveTrip(owner, v.trip.id, u.trip.version);
  return u.trip;
}

describe('loadSharedMemberMap: one null for every failure', () => {
  it('returns the visited-only projection for a live token and nothing else', async () => {
    const owner = await setup();
    await trip(owner, 'ha-giang', 'completed');
    await trip(owner, 'sa-pa', 'planned');
    await trip(owner, 'sa-pa', 'draft');
    const token = (await planner.setMemberMapShare(owner, { enabled: true, shareName: 'anonymous' })).token ?? '';
    const map = await loadSharedMemberMap(freshHeaders(), token);
    expect(map).toEqual({ displayName: null, points: [{ slug: 'ha-giang', visitsBucket: 1 }] });
    expect(Object.keys(map!.points[0]!).sort()).toEqual(['slug', 'visitsBucket']);
    expect(JSON.stringify(map)).not.toContain('Tên Bí Mật');
  });

  it('answers null for malformed, unknown, revoked, banned and deleted-owner tokens alike', async () => {
    const owner = await setup();
    await trip(owner, 'ha-giang', 'completed');
    const token = (await planner.setMemberMapShare(owner, { enabled: true, shareName: 'anonymous' })).token ?? '';
    const outcomes = [
      await loadSharedMemberMap(freshHeaders(), 'short'),
      await loadSharedMemberMap(freshHeaders(), 'x'.repeat(43)),
      await loadSharedMemberMap(freshHeaders(), '../../etc/passwd'),
    ];
    await planner.revokeMemberMapShare(owner);
    outcomes.push(await loadSharedMemberMap(freshHeaders(), token));
    const second = await planner.setMemberMapShare(owner, { enabled: true, shareName: 'anonymous' }).then(() => planner.rotateMemberMapShare(owner));
    expect(await loadSharedMemberMap(freshHeaders(), second.token)).not.toBeNull();
    const admin = (await planner.createUser({ handle: 'adm', displayName: 'Quản trị', role: 'super_admin' })).user.id;
    await planner.changeAccountState(owner, 'ban', { userId: admin });
    outcomes.push(await loadSharedMemberMap(freshHeaders(), second.token));
    await planner.changeAccountState(owner, 'unban', { userId: admin });
    await planner.deleteUser(owner);
    outcomes.push(await loadSharedMemberMap(freshHeaders(), second.token));
    expect(outcomes.every((o) => o === null)).toBe(true);
  });

  it('answers null (not a distinct state) when the limiter fires', async () => {
    const owner = await setup();
    const token = (await planner.setMemberMapShare(owner, { enabled: true, shareName: 'anonymous' })).token ?? '';
    const h = headers('203.0.113.9');
    let last: unknown = 'unset';
    for (let i = 0; i < 61; i += 1) last = await loadSharedMemberMap(h, token);
    expect(last).toBeNull();
  });

  it('a deleted completed trip leaves at once; an archived completed one stays', async () => {
    const owner = await setup();
    const a = await trip(owner, 'ha-giang', 'completed', true);
    const b = await trip(owner, 'sa-pa', 'completed');
    const token = (await planner.setMemberMapShare(owner, { enabled: true, shareName: 'anonymous' })).token ?? '';
    expect((await loadSharedMemberMap(freshHeaders(), token))!.points.map((p) => p.slug)).toEqual(['ha-giang', 'sa-pa']);
    await store.transact((d) => {
      d.trips = d.trips.filter((t) => t.id !== b.id);
    });
    expect((await loadSharedMemberMap(freshHeaders(), token))!.points.map((p) => p.slug)).toEqual(['ha-giang']);
    expect(a.id).toBeTruthy();
  });
});

describe('sharedMapDestinations', () => {
  it('draws catalog coordinates with the three pin sizes and drops a slug outside the catalog', () => {
    const out = sharedMapDestinations([
      { slug: 'ha-giang', visitsBucket: 1 },
      { slug: 'sa-pa', visitsBucket: 3 },
      { slug: 'not-in-catalog', visitsBucket: 2 },
    ]);
    expect(out.map((d) => [d.slug, d.visits])).toEqual([['ha-giang', 1], ['sa-pa', 4]]);
    expect(sharedMapDestinations([{ slug: 'x', visitsBucket: 1 }])).toEqual([]);
  });
});

describe('route, headers, metadata', () => {
  const page = read('src/app/[locale]/shared-map/[token]/page.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('is a localized route in both languages and has no JSON endpoint', () => {
    expect(pathnames['/shared-map/[token]']).toEqual({ vi: '/ban-do-chia-se/[token]', en: '/shared-map/[token]' });
    expect(mapSharePaths).toEqual(['/ban-do-chia-se/:path*', '/en/shared-map/:path*']);
    expect(() => read('src/app/api/shared-map/route.ts')).toThrow();
  });

  it('is dynamic, never indexed, with generic metadata that ignores the token and the owner', () => {
    expect(page).toContain("export const dynamic = 'force-dynamic'");
    const meta = page.slice(page.indexOf('generateMetadata'), page.indexOf('export default'));
    expect(meta).toContain('index: false, follow: false');
    expect(meta).toContain("referrer: 'no-referrer'");
    expect(meta).not.toMatch(/token|displayName|map\.|alternates|openGraph|loadSharedMemberMap/);
    expect(page).not.toMatch(/application\/ld\+json|alternates|openGraph|buildPageMetadata/);
    expect(page).toMatch(/if \(!map\) notFound\(\)/);
  });

  it('restates no-referrer, noindex and no-store on both locale paths', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    for (const source of mapSharePaths) {
      const last = rules.filter((r) => r.source === source).at(-1);
      expect(last?.headers).toEqual([
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'private, no-store' },
      ]);
    }
  });

  it('is disallowed in robots and absent from the sitemap', async () => {
    const rules = robots().rules as { disallow: string[] };
    expect(rules.disallow).toEqual(expect.arrayContaining(['/ban-do-chia-se', '/en/shared-map']));
    const urls = JSON.stringify(await sitemap());
    expect(urls).not.toMatch(/ban-do-chia-se|shared-map/);
  });
});

describe('messages', () => {
  it('has the same sharedMap keys in Vietnamese and English, and the bucket labels', () => {
    const vi = Object.keys(vi_.sharedMap).sort();
    expect(vi).toEqual(Object.keys(en_.sharedMap).sort());
    expect(vi).toEqual(expect.arrayContaining(['bucket1', 'bucket2', 'bucket3', 'title', 'titleNamed', 'empty']));
  });
});
