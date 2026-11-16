import { generateKeyPairSync, sign, type JsonWebKey, type KeyObject } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import {
  GOOGLE_JWKS_URL,
  GOOGLE_TOKEN_URL,
  OAUTH_STATE_COOKIE,
  googleConfig,
  pkceChallenge,
  resetGoogleKeyCache,
  verifyGoogleIdToken,
} from '../src/server/planner/google';
import { MAX_LIVE_OAUTH_ATTEMPTS } from '../src/server/planner/schemas';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { makePlanner } from './planner-helpers';

/**
 * ADR 0007, Google half: id_token verification, account matching / linking /
 * creation, and the two routes end to end against a fake Google.
 */

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const NOW = new Date('2026-11-10T08:00:00.000Z');
const nowSeconds = Math.floor(NOW.getTime() / 1000);

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1';
const jwk = { ...(publicKey.export({ format: 'jwk' }) as JsonWebKey), kid: KID, alg: 'RS256', use: 'sig' };

function mint(claims: Record<string, unknown>, key: KeyObject = privateKey, kid = KID): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

const goodClaims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '1098765432101234567890',
  email: 'Khach.Hang@Gmail.com',
  email_verified: true,
  name: 'Khách Hàng',
  nonce: 'the-expected-nonce-value',
  iat: nowSeconds - 10,
  exp: nowSeconds + 3600,
  ...overrides,
});

/** A fake Google: JWKS always, token endpoint returning `idToken()` when set. */
let idToken: () => string = () => '';
const jwksCalls = { count: 0 };
const fakeFetch = vi.fn(async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === GOOGLE_JWKS_URL) {
    jwksCalls.count += 1;
    return new Response(JSON.stringify({ keys: [jwk] }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
    });
  }
  if (url === GOOGLE_TOKEN_URL) {
    return new Response(JSON.stringify({ id_token: idToken(), access_token: 'unused' }), {
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response('not found', { status: 404 });
}) as unknown as typeof fetch;

const verifyOptions = { clientId: CLIENT_ID, nonce: 'the-expected-nonce-value', now: NOW, fetchImpl: fakeFetch };

beforeEach(() => {
  resetGoogleKeyCache();
  jwksCalls.count = 0;
});

describe('configuration', () => {
  it('is off unless both the client id and the secret are set', () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: 'x' })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' })).toMatchObject({ signupEnabled: true });
    expect(
      googleConfig({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y', GOOGLE_SIGNUP_ENABLED: 'false' }),
    ).toMatchObject({ signupEnabled: false });
  });

  it('derives the S256 PKCE challenge from RFC 7636 appendix B', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('id_token verification', () => {
  it('accepts a correct token and normalises the email', async () => {
    const identity = await verifyGoogleIdToken(mint(goodClaims()), verifyOptions);
    expect(identity).toEqual({ sub: '1098765432101234567890', email: 'khach.hang@gmail.com', name: 'Khách Hàng' });
  });

  it('caches Google keys between verifications', async () => {
    await verifyGoogleIdToken(mint(goodClaims()), verifyOptions);
    await verifyGoogleIdToken(mint(goodClaims()), verifyOptions);
    expect(jwksCalls.count).toBe(1);
  });

  const refusals: Array<[string, () => string, string]> = [
    ['a signature from another key', () => mint(goodClaims(), other.privateKey), 'google_failed'],
    ['an unknown kid', () => mint(goodClaims(), privateKey, 'rotated-away'), 'google_failed'],
    ['the wrong issuer', () => mint(goodClaims({ iss: 'https://evil.example' })), 'google_failed'],
    ['the wrong audience', () => mint(goodClaims({ aud: 'someone-else' })), 'google_failed'],
    ['an expired token', () => mint(goodClaims({ exp: nowSeconds - 120 })), 'google_failed'],
    ['a token from the future', () => mint(goodClaims({ iat: nowSeconds + 600 })), 'google_failed'],
    ['the wrong nonce', () => mint(goodClaims({ nonce: 'replayed' })), 'google_failed'],
    ['no sub', () => mint(goodClaims({ sub: undefined })), 'google_failed'],
    ['an unverified email', () => mint(goodClaims({ email_verified: false })), 'google_unverified'],
    ['a string "true" email_verified', () => mint(goodClaims({ email_verified: 'true' })), 'google_unverified'],
    ['alg none', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', kid: KID })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(goodClaims())).toString('base64url');
      return `${header}.${payload}.`;
    }, 'google_failed'],
    ['garbage', () => 'not.a.jwt', 'google_failed'],
  ];

  for (const [label, token, code] of refusals) {
    it(`refuses ${label}`, async () => {
      await expect(verifyGoogleIdToken(token(), verifyOptions)).rejects.toMatchObject({ code });
    });
  }
});

describe('resolving a Google identity to an account', () => {
  const identity = { sub: 'google-sub-1', email: 'guest@gmail.com', name: 'Khách Một' };

  it('creates a member account on first sign-in and reuses it after', async () => {
    const planner = makePlanner();
    const first = await planner.signInWithGoogle(identity, { signupEnabled: true });
    expect(first).toMatchObject({ ok: true, created: true });
    if (!first.ok) throw new Error('unreachable');
    expect(first.session.user).toMatchObject({
      handle: 'guest',
      displayName: 'Khách Một',
      email: 'guest@gmail.com',
      createdVia: 'google',
      hasPassword: false,
      hasGoogle: true,
    });

    const second = await planner.signInWithGoogle(identity, { signupEnabled: true });
    expect(second).toMatchObject({ ok: true, created: false });
    if (!second.ok) throw new Error('unreachable');
    expect(second.session.user.id).toBe(first.session.user.id);
    expect(second.session.token).not.toBe(first.session.token);
  });

  it('never links an existing account by email alone, and creates no duplicate', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const staff = await planner.createUser({ handle: 'staff-a', displayName: 'Nhân viên A', email: 'guest@gmail.com' });
    const result = await planner.signInWithGoogle(identity, { signupEnabled: true });
    expect(result).toEqual({ ok: false, reason: 'link_required' });
    const users = (await store.read()).users;
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: staff.user.id });
    expect(users[0]?.googleSub ?? null).toBeNull();
  });

  it('links Google to the signed-in user explicitly, then signs in by it', async () => {
    const planner = makePlanner();
    const staff = await planner.createUser({ handle: 'staff-a', displayName: 'Nhân viên A', email: 'staff@example.vn' });
    // The Google email need not match the account's.
    const linked = await planner.linkGoogle(staff.user.id, identity);
    expect(linked).toMatchObject({ ok: true, user: { id: staff.user.id, hasGoogle: true } });
    // Linking the same account again is a no-op, not a conflict.
    expect(await planner.linkGoogle(staff.user.id, identity)).toMatchObject({ ok: true });

    const result = await planner.signInWithGoogle(identity, { signupEnabled: true });
    expect(result).toMatchObject({ ok: true, created: false });
    if (!result.ok) throw new Error('unreachable');
    expect(result.session.user.id).toBe(staff.user.id);

    // A Google session is not held behind the temporary-password gate.
    const request = new Request('https://example.test/api/planner', {
      headers: { cookie: `${SESSION_COOKIE}=${result.session.token}` },
    });
    expect((await planner.identify(request)).passwordChangeRequired).toBeUndefined();
  });

  it('refuses to link a Google account that belongs to someone else, or a second one', async () => {
    const planner = makePlanner();
    const owner = await planner.signInWithGoogle(identity, { signupEnabled: true });
    if (!owner.ok) throw new Error('unreachable');
    const other = await planner.createUser({ handle: 'staff-b', displayName: 'Nhân viên B' });
    expect(await planner.linkGoogle(other.user.id, identity)).toEqual({ ok: false, reason: 'account_conflict' });
    expect(
      await planner.linkGoogle(owner.session.user.id, { ...identity, sub: 'a-second-google-account' }),
    ).toEqual({ ok: false, reason: 'account_conflict' });
  });

  it('lets a user with a password unlink Google, ending their other sessions but not this one', async () => {
    const planner = makePlanner();
    const staff = await planner.createUser({ handle: 'staff-a', displayName: 'Nhân viên A', email: 'staff@example.vn' });
    await planner.linkGoogle(staff.user.id, identity);
    const here = await planner.signInWithGoogle(identity, { signupEnabled: true });
    const elsewhere = await planner.signInWithGoogle(identity, { signupEnabled: true });
    if (!here.ok || !elsewhere.ok) throw new Error('unreachable');
    const cookie = (token: string) =>
      new Request('https://example.test/api/planner/google', { headers: { cookie: `${SESSION_COOKIE}=${token}` } });

    const user = await planner.unlinkOwnGoogle(cookie(here.session.token), staff.user.id);
    expect(user).toMatchObject({ id: staff.user.id, hasGoogle: false });
    expect((await planner.identify(cookie(here.session.token))).userId).toBe(staff.user.id);
    await expect(planner.identify(cookie(elsewhere.session.token))).rejects.toMatchObject({ code: 'unauthorized' });
    // Google no longer resolves to the account, and unlinking again is a no-op.
    expect(await planner.signInWithGoogle(identity, { signupEnabled: false })).toEqual({
      ok: false,
      reason: 'account_not_found',
    });
    expect(await planner.unlinkOwnGoogle(cookie(here.session.token), staff.user.id)).toMatchObject({ hasGoogle: false });
  });

  it('refuses to unlink Google from an account that has no password', async () => {
    const planner = makePlanner();
    const created = await planner.signInWithGoogle(identity, { signupEnabled: true });
    if (!created.ok) throw new Error('unreachable');
    const request = new Request('https://example.test/api/planner/google', {
      headers: { cookie: `${SESSION_COOKIE}=${created.session.token}` },
    });
    await expect(planner.unlinkOwnGoogle(request, created.session.user.id)).rejects.toMatchObject({
      code: 'invalid_state',
    });
    expect(await planner.signInWithGoogle(identity, { signupEnabled: true })).toMatchObject({ ok: true });
  });

  it('refuses an email already linked to a different Google account', async () => {
    const planner = makePlanner();
    await planner.signInWithGoogle(identity, { signupEnabled: true });
    const result = await planner.signInWithGoogle({ ...identity, sub: 'reassigned-sub' }, { signupEnabled: true });
    expect(result).toEqual({ ok: false, reason: 'account_conflict' });
  });

  it('creates nothing when signup is closed or throttled', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    expect(await planner.signInWithGoogle(identity, { signupEnabled: false })).toEqual({
      ok: false,
      reason: 'account_not_found',
    });
    expect(
      await planner.signInWithGoogle(identity, { signupEnabled: true, allowSignup: () => false }),
    ).toEqual({ ok: false, reason: 'rate_limited' });
    expect((await store.read()).users).toHaveLength(0);
  });

  it('creates one account when two first sign-ins race', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    await Promise.all([
      planner.signInWithGoogle(identity, { signupEnabled: true }),
      planner.signInWithGoogle(identity, { signupEnabled: true }),
    ]);
    expect((await store.read()).users).toHaveLength(1);
  });

  it('suffixes a taken handle and handles odd local parts', async () => {
    const planner = makePlanner();
    await planner.createUser({ handle: 'guest', displayName: 'Đã có' });
    const taken = await planner.signInWithGoogle(identity, { signupEnabled: true });
    if (!taken.ok) throw new Error('unreachable');
    expect(taken.session.user.handle).toMatch(/^guest-[0-9a-f]{6}$/);

    const odd = await planner.signInWithGoogle(
      { sub: 'odd', email: 'a.@gmail.com', name: null },
      { signupEnabled: true },
    );
    if (!odd.ok) throw new Error('unreachable');
    expect(odd.session.user.handle).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(odd.session.user.handle.length).toBeGreaterThanOrEqual(3);
    expect(odd.session.user.displayName.length).toBeGreaterThanOrEqual(2);
  });

  it('a Google state is good for one callback only', async () => {
    const planner = makePlanner();
    await planner.beginGoogleSignIn({
      stateHash: 'a'.repeat(64),
      nonce: 'n'.repeat(43),
      codeVerifier: 'v'.repeat(43),
      returnTo: '/my-trips',
      locale: 'vi',
    });
    expect(await planner.consumeGoogleAttempt('a'.repeat(64))).toMatchObject({ returnTo: '/my-trips' });
    expect(await planner.consumeGoogleAttempt('a'.repeat(64))).toBeNull();
  });

  it('caps in-flight attempts across all clients and frees room as they expire', async () => {
    let clock = NOW.getTime();
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store, now: () => new Date(clock) });
    const attempt = (i: number) => ({
      stateHash: i.toString(16).padStart(64, '0'),
      nonce: 'n'.repeat(43),
      codeVerifier: 'v'.repeat(43),
      returnTo: '/my-trips',
      locale: 'vi' as const,
    });
    for (let i = 0; i < MAX_LIVE_OAUTH_ATTEMPTS; i += 1) {
      expect(await planner.beginGoogleSignIn(attempt(i))).toBe(true);
    }
    expect(await planner.beginGoogleSignIn(attempt(MAX_LIVE_OAUTH_ATTEMPTS))).toBe(false);
    expect((await store.read()).oauthAttempts).toHaveLength(MAX_LIVE_OAUTH_ATTEMPTS);

    clock += 11 * 60_000;
    expect(await planner.beginGoogleSignIn(attempt(MAX_LIVE_OAUTH_ATTEMPTS))).toBe(true);
    expect((await store.read()).oauthAttempts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// HTTP: start → fake Google → callback, through the real route handlers
// ---------------------------------------------------------------------------

const ORIGIN = 'https://example.test';
let workdir: string;
let routes: {
  start: typeof import('../src/app/api/planner/oauth/google/start/route');
  callback: typeof import('../src/app/api/planner/oauth/google/callback/route');
  session: typeof import('../src/app/api/planner/session/route');
  instance: typeof import('../src/server/planner/instance');
};

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-google-api-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = 'test-admin-token-at-least-32-chars-long';
  delete process.env.NEXT_PUBLIC_SITE_URL;
  routes = {
    start: await import('../src/app/api/planner/oauth/google/start/route'),
    callback: await import('../src/app/api/planner/oauth/google/callback/route'),
    session: await import('../src/app/api/planner/session/route'),
    instance: await import('../src/server/planner/instance'),
  };
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_SIGNUP_ENABLED;
});

function enableGoogle() {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  vi.stubGlobal('fetch', fakeFetch);
}

/** Runs /start and returns what Google would receive and what the browser keeps. */
/** Each start gets its own address, so the per-client limiter is not what a test measures. */
let startCount = 0;
async function start(query = 'returnTo=%2Fmy-trips&locale=vi', sessionToken?: string) {
  startCount += 1;
  const headers: Record<string, string> = { 'x-forwarded-for': `198.51.100.${startCount}` };
  if (sessionToken) headers.cookie = `${SESSION_COOKIE}=${sessionToken}`;
  const response = await routes.start.GET(new Request(`${ORIGIN}/api/planner/oauth/google/start?${query}`, { headers }));
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get('location')!);
  const cookie = response.headers.get('set-cookie')!;
  return {
    location,
    state: location.searchParams.get('state')!,
    nonce: location.searchParams.get('nonce')!,
    cookie,
  };
}

function callback(state: string, cookieState: string | null, extra = 'code=auth-code', sessionToken?: string) {
  const headers: Record<string, string> = {};
  const cookies = [
    cookieState ? `${OAUTH_STATE_COOKIE}=${cookieState}` : null,
    sessionToken ? `${SESSION_COOKIE}=${sessionToken}` : null,
  ].filter(Boolean);
  if (cookies.length > 0) headers.cookie = cookies.join('; ');
  return routes.callback.GET(
    new Request(`${ORIGIN}/api/planner/oauth/google/callback?state=${encodeURIComponent(state)}&${extra}`, { headers }),
  );
}

const realNow = () => Math.floor(Date.now() / 1000);

// One test creates a user with an email, which hashes at the production cost.
describe('Google sign-in over HTTP', { timeout: 30_000 }, () => {
  it('answers 404 on both routes when Google is not configured', async () => {
    expect((await routes.start.GET(new Request(`${ORIGIN}/api/planner/oauth/google/start`))).status).toBe(404);
    expect((await callback('x', 'x')).status).toBe(404);
  });

  it('redirects to Google with PKCE, nonce, state and a scoped state cookie', async () => {
    enableGoogle();
    const { location, state, cookie } = await start();
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/planner/oauth/google/callback`);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('scope')).toBe('openid email profile');
    expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=${state}`);
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(cookie).toContain('Path=/api/planner/oauth');
  });

  it('signs a new customer in, creates the account, and returns them where they were', async () => {
    enableGoogle();
    const { state, nonce } = await start('returnTo=%2Fen%2Fmy-trips&locale=en');
    idToken = () => mint(goodClaims({ nonce, iat: realNow() - 5, exp: realNow() + 3600, sub: 'http-sub-1', email: 'new.customer@gmail.com' }));

    const response = await callback(state, state);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/en/my-trips`);
    const cookies = response.headers.get('set-cookie')!;
    expect(cookies).toContain(`${SESSION_COOKIE}=`);

    const token = cookies.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))![1]!;
    const who = await routes.session.GET(
      new Request(`${ORIGIN}/api/planner/session`, { headers: { cookie: `${SESSION_COOKIE}=${token}` } }),
    );
    expect((await who.json()).user).toEqual({
      displayName: 'Khách Hàng',
      role: 'member',
      hasPassword: false,
      hasGoogle: true,
    });
  });

  it('refuses a state that does not match the cookie, and burns it', async () => {
    enableGoogle();
    const { state, nonce } = await start();
    idToken = () => mint(goodClaims({ nonce, iat: realNow(), exp: realNow() + 3600 }));

    const forged = await callback(state, 'someone-elses-state');
    expect(forged.headers.get('location')).toBe(`${ORIGIN}/dang-nhap?error=google_failed&returnTo=%2Fmy-trips`);
    // The attempt was consumed, so even the right cookie cannot use it now.
    const replay = await callback(state, state);
    expect(replay.headers.get('location')).toContain('error=google_failed');
    expect(replay.headers.get('set-cookie') ?? '').not.toContain(`${SESSION_COOKIE}=`);
  });

  it('reports a cancelled consent and an unverified email with their own codes', async () => {
    enableGoogle();
    const cancelled = await start();
    expect((await callback(cancelled.state, cancelled.state, 'error=access_denied')).headers.get('location')).toContain(
      'error=google_cancelled',
    );

    const unverified = await start();
    idToken = () => mint(goodClaims({ nonce: unverified.nonce, iat: realNow(), exp: realNow() + 3600, email_verified: false }));
    expect((await callback(unverified.state, unverified.state)).headers.get('location')).toContain('error=google_unverified');
  });

  it('refuses an unknown customer when signup is switched off', async () => {
    enableGoogle();
    process.env.GOOGLE_SIGNUP_ENABLED = 'false';
    const { state, nonce } = await start();
    idToken = () => mint(goodClaims({ nonce, iat: realNow(), exp: realNow() + 3600, sub: 'closed-sub', email: 'closed@gmail.com' }));
    const response = await callback(state, state);
    expect(response.headers.get('location')).toContain('error=account_not_found');
  });

  it('sends an existing account by email back to sign in, asking to link', async () => {
    enableGoogle();
    const repository = await routes.instance.getPlannerRepository();
    await repository.createUser({ handle: 'http-staff-email', displayName: 'Nhân viên', email: 'staff.http@gmail.com' });
    const { state, nonce } = await start();
    idToken = () => mint(goodClaims({ nonce, iat: realNow(), exp: realNow() + 3600, sub: 'unlinked-sub', email: 'staff.http@gmail.com' }));
    const response = await callback(state, state);
    expect(response.headers.get('location')).toContain('/dang-nhap?error=link_required');
    expect(response.headers.get('set-cookie') ?? '').not.toContain(`${SESSION_COOKIE}=`);
  });

  it('links Google for a signed-in user and returns to the account page', async () => {
    enableGoogle();
    const repository = await routes.instance.getPlannerRepository();
    const staff = await repository.createUser({ handle: 'http-linker', displayName: 'Người liên kết' });
    const session = await repository.signIn(staff.accessToken);

    const { state, nonce } = await start('intent=link&locale=vi', session.token);
    idToken = () => mint(goodClaims({ nonce, iat: realNow(), exp: realNow() + 3600, sub: 'link-sub-1', email: 'linker.personal@gmail.com' }));
    const response = await callback(state, state, 'code=auth-code', session.token);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/doi-mat-khau?google=linked`);
    // Linking keeps the existing session; it does not issue a new one.
    expect(response.headers.get('set-cookie') ?? '').not.toContain(`${SESSION_COOKIE}=`);

    const next = await start();
    idToken = () => mint(goodClaims({ nonce: next.nonce, iat: realNow(), exp: realNow() + 3600, sub: 'link-sub-1', email: 'linker.personal@gmail.com' }));
    const signedIn = await callback(next.state, next.state);
    expect(signedIn.headers.get('location')).toBe(`${ORIGIN}/my-trips`);
    expect(signedIn.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`);
  });

  it('refuses to start linking without a session, and to finish it as someone else', async () => {
    enableGoogle();
    const anonymous = await routes.start.GET(new Request(`${ORIGIN}/api/planner/oauth/google/start?intent=link&locale=vi`));
    expect(anonymous.headers.get('location')).toContain('/dang-nhap?error=google_failed');

    const repository = await routes.instance.getPlannerRepository();
    const victim = await repository.createUser({ handle: 'http-victim', displayName: 'Nạn nhân' });
    const victimSession = await repository.signIn(victim.accessToken);
    const { state, nonce } = await start('intent=link&locale=vi', victimSession.token);
    idToken = () => mint(goodClaims({ nonce, iat: realNow(), exp: realNow() + 3600, sub: 'link-sub-2' }));
    // Same browser state cookie, but no longer signed in as the user who started.
    const response = await callback(state, state);
    expect(response.headers.get('location')).toContain('/dang-nhap?error=google_failed');
    expect((await repository.listUsers()).find((user) => user.id === victim.user.id)?.hasGoogle).toBe(false);
  });

  it('never sends a visitor off-site through returnTo', async () => {
    enableGoogle();
    const { state, nonce } = await start('returnTo=https%3A%2F%2Fevil.example%2F&locale=vi');
    idToken = () => mint(goodClaims({ nonce, iat: realNow(), exp: realNow() + 3600, sub: 'redirect-sub', email: 'redirect@gmail.com' }));
    const response = await callback(state, state);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/my-trips`);
  });
});
