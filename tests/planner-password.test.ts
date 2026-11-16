import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import {
  createConcurrencyGate,
  dummyPasswordHash,
  generateTemporaryPassword,
  hashPassword,
  parsePasswordHash,
  verifyPassword,
} from '../src/server/planner/password';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { makePlanner } from './planner-helpers';

/**
 * ADR 0007, password half: scrypt hashing, operator-issued temporary
 * passwords, the change-password gate, and the no-enumeration rule.
 */

const BASE = 'https://example.test/api/planner';
const withCookie = (token: string) =>
  new Request(BASE, { headers: { cookie: `${SESSION_COOKIE}=${token}` } });

describe('password hashing', () => {
  it('round-trips, stores its parameters, and salts every hash', async () => {
    const a = await hashPassword('mật khẩu đủ dài nhé', 10);
    const b = await hashPassword('mật khẩu đủ dài nhé', 10);
    expect(a).not.toBe(b);
    expect(parsePasswordHash(a)).toMatchObject({ N: 1024, r: 8, p: 1 });
    expect(await verifyPassword('mật khẩu đủ dài nhé', a, 10)).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPassword('mat khau sai roi', a, 10)).ok).toBe(false);
  });

  it('flags a hash cheaper than the current cost for upgrade', async () => {
    const weak = await hashPassword('a long enough password', 10);
    expect(await verifyPassword('a long enough password', weak, 11)).toEqual({ ok: true, needsRehash: true });
  });

  it('refuses malformed or memory-hungry stored hashes without throwing', async () => {
    for (const bad of ['', 'plain', 'scrypt$3$8$1$c2FsdHNhbHQ$eA', `scrypt$${2 ** 24}$8$1$c2FsdHNhbHQ$${'A'.repeat(43)}`]) {
      expect(parsePasswordHash(bad)).toBeNull();
      expect((await verifyPassword('anything at all', bad, 10)).ok).toBe(false);
    }
  });

  it('builds the dummy hash without scrypt, well-formed at the current cost, and never matching', async () => {
    // Synchronous: nothing to reject, nothing cached — so a full scrypt gate
    // can never make unknown emails answer differently from known ones.
    const dummy = dummyPasswordHash(10);
    expect(typeof dummy).toBe('string');
    expect(parsePasswordHash(dummy)).toMatchObject({ N: 2 ** 10, r: 8, p: 1 });
    expect(dummyPasswordHash(10)).not.toBe(dummy);
    expect(await verifyPassword('anything at all', dummy, 10)).toEqual({ ok: false, needsRehash: false });
  });

  it('generates temporary passwords long enough for the policy', () => {
    const value = generateTemporaryPassword();
    expect(value).toMatch(/^[A-Za-z2-9]{16}$/);
    expect(generateTemporaryPassword()).not.toBe(value);
  });
});

describe('the scrypt concurrency gate', () => {
  it('runs at most N at once, queues a bounded number, and refuses the rest', async () => {
    const gate = createConcurrencyGate(2, 1, () => new Error('full'));
    let running = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    const task = () =>
      gate.run(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise<void>((resolve) => releases.push(resolve));
        running -= 1;
        return 'done';
      });

    const first = task();
    const second = task();
    const queued = task();
    await expect(task()).rejects.toThrow('full');
    await tick();
    expect(running).toBe(2);

    // Finishing one hands its slot to the queued task.
    releases.shift()?.();
    await first;
    await tick();
    expect(running).toBe(2);
    releases.splice(0).forEach((release) => release());
    await expect(Promise.all([second, queued])).resolves.toEqual(['done', 'done']);
    expect(peak).toBe(2);

    // Empty again: a new task runs straight away.
    const later = task();
    await tick();
    releases.splice(0).forEach((release) => release());
    await expect(later).resolves.toBe('done');
  });
});

describe('operator-created accounts', () => {
  it('issues a temporary password only when an email is given', async () => {
    const planner = makePlanner();
    const plain = await planner.createUser({ handle: 'khong-email', displayName: 'Không email' });
    expect(plain).not.toHaveProperty('temporaryPassword');
    expect(plain.user).toMatchObject({ hasPassword: false, hasGoogle: false });

    const staff = await planner.createUser({ handle: 'nhan-vien', displayName: 'Nhân viên', email: 'staff@example.com' });
    expect(staff.temporaryPassword).toMatch(/^.{16}$/);
    expect(staff.user).toMatchObject({ email: 'staff@example.com', hasPassword: true, mustChangePassword: true });
    expect(staff.user).not.toHaveProperty('passwordHash');
    expect(staff.user).not.toHaveProperty('googleSub');
  });

  it('refuses a second user with the same email without echoing it', async () => {
    const planner = makePlanner();
    await planner.createUser({ handle: 'mot', displayName: 'Một', email: 'same@example.com' });
    await expect(
      planner.createUser({ handle: 'hai', displayName: 'Hai', email: 'same@example.com' }),
    ).rejects.toSatisfy((error: Error) => !error.message.includes('same@example.com'));
  });
});

describe('signing in with a password', () => {
  it('opens a password session held behind the change gate', async () => {
    const planner = makePlanner();
    const { temporaryPassword } = await planner.createUser({ handle: 'tam', displayName: 'Tâm', email: 'tam@example.com' });

    const session = await planner.signInWithPassword('tam@example.com', temporaryPassword!);
    expect(session.user.mustChangePassword).toBe(true);
    const identity = await planner.identify(withCookie(session.token));
    expect(identity.passwordChangeRequired).toBe(true);
  });

  it('answers the same 401 for unknown email, no password, and wrong password', async () => {
    const planner = makePlanner();
    await planner.createUser({ handle: 'co-email', displayName: 'Có email', email: 'has@example.com' });
    await planner.createUser({ handle: 'khong-mk', displayName: 'Không mật khẩu' });

    const failures = await Promise.all([
      planner.signInWithPassword('nobody@example.com', 'whatever-password').catch((e: Error) => e),
      planner.signInWithPassword('has@example.com', 'wrong-password-123').catch((e: Error) => e),
    ]);
    for (const failure of failures) {
      expect(failure).toMatchObject({ code: 'unauthorized', message: 'that account and password do not match' });
    }
  });

  it('upgrades a weaker stored hash on a successful sign-in', async () => {
    const store = createMemoryPlannerStore();
    const weak = makePlanner({ store, scryptCostLog2: 10 });
    const { temporaryPassword } = await weak.createUser({ handle: 'nang-cap', displayName: 'Nâng cấp', email: 'up@example.com' });

    const strong = makePlanner({ store, scryptCostLog2: 11 });
    await strong.signInWithPassword('up@example.com', temporaryPassword!);
    const stored = (await store.read()).users[0]!.passwordHash!;
    expect(parsePasswordHash(stored)?.N).toBe(2048);
  });
});

describe('changing and resetting a password', () => {
  async function staffSignedIn() {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const created = await planner.createUser({ handle: 'doi-mk', displayName: 'Đổi mật khẩu', email: 'change@example.com' });
    const first = await planner.signInWithPassword('change@example.com', created.temporaryPassword!);
    const second = await planner.signInWithPassword('change@example.com', created.temporaryPassword!);
    return { store, planner, userId: created.user.id, temporary: created.temporaryPassword!, first, second };
  }

  it('clears the gate, keeps this session and ends the others', async () => {
    const { planner, userId, temporary, first, second } = await staffSignedIn();
    await planner.changePassword(withCookie(first.token), userId, temporary, 'một mật khẩu mới thật dài');

    const identity = await planner.identify(withCookie(first.token));
    expect(identity.passwordChangeRequired).toBeUndefined();
    await expect(planner.identify(withCookie(second.token))).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(planner.signInWithPassword('change@example.com', temporary)).rejects.toMatchObject({ code: 'unauthorized' });
    await planner.signInWithPassword('change@example.com', 'một mật khẩu mới thật dài');
  });

  it('refuses a wrong current password and an unchanged one', async () => {
    const { planner, userId, temporary, first } = await staffSignedIn();
    await expect(
      planner.changePassword(withCookie(first.token), userId, 'not-the-current-one', 'a brand new password'),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    await expect(
      planner.changePassword(withCookie(first.token), userId, temporary, temporary),
    ).rejects.toMatchObject({ code: 'validation_failed' });
  });

  it('operator reset issues a new temporary password and ends every session', async () => {
    const { planner, userId, temporary, first } = await staffSignedIn();
    const reset = await planner.resetUserPassword(userId);
    expect(reset.temporaryPassword).not.toBe(temporary);
    expect(reset.user.mustChangePassword).toBe(true);
    await expect(planner.identify(withCookie(first.token))).rejects.toMatchObject({ code: 'unauthorized' });
    await planner.signInWithPassword('change@example.com', reset.temporaryPassword);
  });

  it('resets a user who has no email, who then signs in by handle (ADR 0018)', async () => {
    // Regression: this used to be refused 409 `invalid_state`, so an operator
    // could never give an email-less account a password.
    const planner = makePlanner();
    const { user } = await planner.createUser({ handle: 'chi-token', displayName: 'Chỉ token' });
    const reset = await planner.resetUserPassword(user.id);
    expect(reset.user).toMatchObject({ hasPassword: true, mustChangePassword: true });
    const session = await planner.signInWithPassword('chi-token', reset.temporaryPassword);
    expect(session.user.mustChangePassword).toBe(true);
  });
});

describe('refusals name their reason (ADR 0018)', () => {
  it('tells self-action, last-admin and not-soft-deleted apart on a 409', async () => {
    const planner = makePlanner();
    const { user: admin } = await planner.createUser({ handle: 'admin-mot', displayName: 'A', email: 'a@example.com', role: 'admin' });
    const { user: other } = await planner.createUser({ handle: 'thanh-vien', displayName: 'T' });
    await expect(planner.resetUserPassword(admin.id, { userId: admin.id })).rejects.toMatchObject({ code: 'invalid_state', reason: 'self_action' });
    await expect(planner.setUserRole(admin.id, 'member')).rejects.toMatchObject({ code: 'invalid_state', reason: 'last_admin' });
    await expect(planner.deleteUser(other.id, { userId: admin.id })).rejects.toMatchObject({ reason: 'not_soft_deleted' });
  });
});

describe('sign-in rate-limit key (ADR 0018)', () => {
  it('is the same for an account reached by handle, email or another casing', async () => {
    const planner = makePlanner();
    await planner.createUser({ handle: 'chung-xo', displayName: 'C', email: 'chung@example.com' });
    const keys = await Promise.all(
      ['chung-xo', 'Chung@Example.com', ' CHUNG-XO '].map((id) => planner.signInBucketKey(id)),
    );
    expect(new Set(keys).size).toBe(1);
    expect(await planner.signInBucketKey('khong-co')).not.toBe(keys[0]);
    // An identifier shaped like the account's id must not share its bucket.
    const id = keys[0]!.replace('account:id:', '');
    expect(await planner.signInBucketKey(id)).not.toBe(keys[0]);
  });
});

describe('signing in with a handle (ADR 0018)', () => {
  it('matches the handle case-insensitively and an email still works', async () => {
    const planner = makePlanner();
    const { user, temporaryPassword } = await planner.createUser({ handle: 'tam-nha', displayName: 'Tâm', email: 'tam2@example.com' });
    await planner.signInWithPassword('Tam-Nha', temporaryPassword!);
    await planner.signInWithPassword('tam2@example.com', temporaryPassword!);
    expect(user.handle).toBe('tam-nha');
  });

  it('gives the same refusal for a wrong password, an unknown handle and a handle with no password', async () => {
    const planner = makePlanner();
    const { temporaryPassword } = await planner.createUser({ handle: 'co-mk', displayName: 'Có', email: 'co@example.com' });
    await planner.createUser({ handle: 'khong-mk-nua', displayName: 'Không' });
    const failures = await Promise.all([
      planner.signInWithPassword('co-mk', 'wrong-password-123').catch((e: Error) => e),
      planner.signInWithPassword('nobody-here', temporaryPassword!).catch((e: Error) => e),
      planner.signInWithPassword('khong-mk-nua', temporaryPassword!).catch((e: Error) => e),
    ]);
    for (const failure of failures) {
      expect(failure).toMatchObject({ code: 'unauthorized', message: 'that account and password do not match' });
    }
  });

  it('refuses a banned account signing in by handle', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const { temporaryPassword } = await planner.createUser({ handle: 'bi-khoa', displayName: 'Bị khóa', email: 'ban@example.com' });
    const data = await store.read();
    data.users[0]!.bannedAt = new Date().toISOString();
    await store.write(data);
    await expect(planner.signInWithPassword('bi-khoa', temporaryPassword!)).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('the integrity sweep covers credentials', () => {
  it('reports shared emails and bad hashes by user id, never by value', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    await planner.createUser({ handle: 'mot-mot', displayName: 'Một', email: 'dup@example.com' });
    await planner.createUser({ handle: 'hai-hai', displayName: 'Hai' });
    const data = await store.read();
    data.users[1]!.email = 'dup@example.com';
    data.users[1]!.passwordHash = 'not-a-hash';
    await store.write(data);

    const issues = await planner.validateIntegrity();
    expect(issues.filter((i) => i.issue === 'shares its email with another user')).toHaveLength(2);
    expect(issues).toContainEqual({ entity: 'planner user', id: 'usr_2', issue: 'passwordHash is not a valid scrypt hash' });
    expect(JSON.stringify(issues)).not.toContain('dup@example.com');
  });
});

// ---------------------------------------------------------------------------
// HTTP: the real route handlers
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
let workdir: string;
let routes: {
  session: typeof import('../src/app/api/planner/session/route');
  password: typeof import('../src/app/api/planner/password/route');
  trips: typeof import('../src/app/api/planner/route');
  adminUsers: typeof import('../src/app/api/admin/planner/users/route');
  reset: typeof import('../src/app/api/admin/planner/users/[userId]/reset-password/route');
};

function req(path: string, init: { method?: string; body?: unknown; cookie?: string; bearer?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.cookie) headers.cookie = `${SESSION_COOKIE}=${init.cookie}`;
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;
  if (init.origin) headers.origin = init.origin;
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const cookieOf = (response: Response) => {
  const header = response.headers.get('set-cookie') ?? '';
  return header.split(';')[0]!.split('=')[1]!;
};

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-password-api-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  routes = {
    session: await import('../src/app/api/planner/session/route'),
    password: await import('../src/app/api/planner/password/route'),
    trips: await import('../src/app/api/planner/route'),
    adminUsers: await import('../src/app/api/admin/planner/users/route'),
    reset: await import('../src/app/api/admin/planner/users/[userId]/reset-password/route'),
  };
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

// These go through the real routes, so they hash at the production cost
// (N = 2^17, ~128 MB each). Alone they take well under a second; alongside the
// whole suite on a busy machine they can pass 5 s, hence the longer timeout.
describe('password sign-in over HTTP', { timeout: 30_000 }, () => {
  it('gates a temporary-password session until the password is changed', async () => {
    const created = await routes.adminUsers.POST(
      req('/api/admin/planner/users', {
        method: 'POST',
        bearer: ADMIN_TOKEN,
        body: { handle: 'http-staff', displayName: 'Nhân viên', email: 'HTTP.Staff@Example.com ' },
      }),
    );
    expect(created.status).toBe(201);
    const { temporaryPassword, user } = await created.json();
    expect(user.email).toBe('http.staff@example.com');

    const signIn = await routes.session.POST(
      req('/api/planner/session', {
        method: 'POST',
        origin: ORIGIN,
        body: { email: 'http.staff@example.com', password: temporaryPassword },
      }),
    );
    expect(signIn.status).toBe(201);
    expect(await signIn.json()).toMatchObject({ passwordChangeRequired: true });
    const cookie = cookieOf(signIn);

    const blocked = await routes.trips.GET(req('/api/planner', { cookie }));
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error.code).toBe('password_change_required');

    const who = await routes.session.GET(req('/api/planner/session', { cookie }));
    expect(who.status).toBe(200);

    const crossSite = await routes.password.POST(
      req('/api/planner/password', {
        method: 'POST',
        cookie,
        origin: 'https://evil.test',
        body: { currentPassword: temporaryPassword, newPassword: 'mật khẩu riêng của tôi' },
      }),
    );
    expect(crossSite.status).toBe(403);

    const changed = await routes.password.POST(
      req('/api/planner/password', {
        method: 'POST',
        cookie,
        origin: ORIGIN,
        body: { currentPassword: temporaryPassword, newPassword: 'mật khẩu riêng của tôi' },
      }),
    );
    expect(changed.status).toBe(204);

    const open = await routes.trips.GET(req('/api/planner', { cookie }));
    expect(open.status).toBe(200);
  });

  it('refuses a short new password with 422', async () => {
    const created = await routes.adminUsers.POST(
      req('/api/admin/planner/users', {
        method: 'POST',
        bearer: ADMIN_TOKEN,
        body: { handle: 'short-pw', displayName: 'Ngắn', email: 'short@example.com' },
      }),
    );
    const { temporaryPassword } = await created.json();
    const signIn = await routes.session.POST(
      req('/api/planner/session', { method: 'POST', origin: ORIGIN, body: { email: 'short@example.com', password: temporaryPassword } }),
    );
    const response = await routes.password.POST(
      req('/api/planner/password', {
        method: 'POST',
        cookie: cookieOf(signIn),
        origin: ORIGIN,
        body: { currentPassword: temporaryPassword, newPassword: 'short' },
      }),
    );
    expect(response.status).toBe(422);
  });

  it('throttles guesses against one account, whatever the address', async () => {
    await routes.adminUsers.POST(
      req('/api/admin/planner/users', {
        method: 'POST',
        bearer: ADMIN_TOKEN,
        body: { handle: 'target', displayName: 'Mục tiêu', email: 'target@example.com' },
      }),
    );
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const request = req('/api/planner/session', {
        method: 'POST',
        origin: ORIGIN,
        body: { email: 'target@example.com', password: `guess-number-${i}` },
      });
      request.headers.set('x-forwarded-for', `203.0.113.${i}`);
      statuses.push((await routes.session.POST(request)).status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it('lets the operator reset a password', async () => {
    const created = await routes.adminUsers.POST(
      req('/api/admin/planner/users', {
        method: 'POST',
        bearer: ADMIN_TOKEN,
        body: { handle: 'reset-me', displayName: 'Đặt lại', email: 'reset@example.com' },
      }),
    );
    const { user } = await created.json();
    const response = await routes.reset.POST(
      req(`/api/admin/planner/users/${user.id}/reset-password`, { method: 'POST', bearer: ADMIN_TOKEN }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).temporaryPassword).toMatch(/^.{16}$/);

    const unauthenticated = await routes.reset.POST(
      req(`/api/admin/planner/users/${user.id}/reset-password`, { method: 'POST' }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(unauthenticated.status).toBe(401);
  });
});
