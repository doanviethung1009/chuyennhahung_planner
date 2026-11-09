import { describe, expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import type { PlannerRepository } from '../src/server/planner/repository';
import { createMemoryPlannerStore, type PlannerStore } from '../src/server/planner/store';
import { makeClock, makeOwner, makePlanner } from './planner-helpers';

/**
 * The session layer from ADR 0004, at the domain level. The cookie attributes
 * and the same-origin rule are HTTP concerns and live in `planner-api.test.ts`.
 */

const BASE = 'https://example.test/api/planner';

/** A request carrying a session cookie. */
function withCookie(token: string, extra = ''): Request {
  return new Request(BASE, {
    headers: { cookie: `${extra}${extra ? '; ' : ''}${SESSION_COOKIE}=${token}` },
  });
}

/** A request carrying a bearer access token. */
function withBearer(token: string): Request {
  return new Request(BASE, { headers: { authorization: `Bearer ${token}` } });
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (!isContentError(error)) throw error;
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`expected the call to fail with "${code}", but it resolved`);
}

async function setup(now?: () => Date): Promise<{
  planner: PlannerRepository;
  store: PlannerStore;
  userId: string;
  accessToken: string;
}> {
  const store = createMemoryPlannerStore();
  const planner = makePlanner({ store, now });
  const { userId, token } = await makeOwner(planner);
  return { planner, store, userId, accessToken: token };
}

describe('signing in', () => {
  it('exchanges an access token for a session and identifies by cookie', async () => {
    const { planner, userId, accessToken } = await setup();

    const issued = await planner.signIn(accessToken);
    expect(issued.user.id).toBe(userId);
    expect(issued.token.length).toBeGreaterThanOrEqual(32);

    const identity = await planner.identify(withCookie(issued.token));
    expect(identity).toEqual({ userId, handle: 'hung-tran', source: 'cookie' });
  });

  it('stores only the digest, never the cookie value', async () => {
    const { planner, store, accessToken } = await setup();
    const issued = await planner.signIn(accessToken);

    const data = await store.read();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // The point of the exercise: a leaked store yields no usable session.
    expect(JSON.stringify(data)).not.toContain(issued.token);
  });

  it('refuses an access token that is not valid', async () => {
    const { planner } = await setup();
    await expectCode(planner.signIn('x'.repeat(64)), 'unauthorized');
  });

  it('issues a separate session per sign-in, so a second device is independent', async () => {
    const { planner, accessToken } = await setup();
    const first = await planner.signIn(accessToken);
    const second = await planner.signIn(accessToken);

    expect(first.token).not.toBe(second.token);
    // Both work — signing in on a phone must not sign the laptop out.
    expect((await planner.identify(withCookie(first.token))).source).toBe('cookie');
    expect((await planner.identify(withCookie(second.token))).source).toBe('cookie');
  });

  it('sets the absolute expiry 14 days out and never extends it', async () => {
    const clock = makeClock();
    const { planner, store, accessToken } = await setup(clock.now);
    const issued = await planner.signIn(accessToken);

    expect(issued.expiresAt).toBe('2026-03-15T08:00:00.000Z');

    // Using the session moves lastSeenAt, not expiresAt.
    clock.advanceDays(3);
    await planner.identify(withCookie(issued.token));
    const data = await store.read();
    expect(data.sessions[0]!.expiresAt).toBe(issued.expiresAt);
    expect(data.sessions[0]!.lastSeenAt).toBe('2026-03-04T08:00:00.000Z');
  });
});

describe('signing out', () => {
  it('deletes the session and makes the cookie useless', async () => {
    const { planner, store, accessToken } = await setup();
    const issued = await planner.signIn(accessToken);

    await planner.signOut(withCookie(issued.token));

    expect((await store.read()).sessions).toEqual([]);
    await expectCode(planner.identify(withCookie(issued.token)), 'unauthorized');
  });

  it('is idempotent, with a spent cookie or none at all', async () => {
    const { planner, accessToken } = await setup();
    const issued = await planner.signIn(accessToken);

    await planner.signOut(withCookie(issued.token));
    // A client retrying a sign-out must not be told it failed.
    await expect(planner.signOut(withCookie(issued.token))).resolves.toBeUndefined();
    await expect(planner.signOut(new Request(BASE))).resolves.toBeUndefined();
  });
});

describe('expiry', () => {
  it('ends a session at the absolute limit and sweeps the row', async () => {
    const clock = makeClock();
    const { planner, store, accessToken } = await setup(clock.now);
    const issued = await planner.signIn(accessToken);

    // Kept alive within the idle window, so only the absolute limit can end it.
    for (let day = 0; day < 14; day += 1) {
      clock.advanceDays(1);
      if (day < 13) await planner.identify(withCookie(issued.token));
    }

    await expectCode(planner.identify(withCookie(issued.token)), 'unauthorized');
    expect((await store.read()).sessions).toEqual([]);
  });

  it('ends a session left idle for a week, well inside the absolute limit', async () => {
    const clock = makeClock();
    const { planner, store, accessToken } = await setup(clock.now);
    const issued = await planner.signIn(accessToken);

    clock.advanceDays(6);
    expect((await planner.identify(withCookie(issued.token))).source).toBe('cookie');

    clock.advanceDays(7);
    await expectCode(planner.identify(withCookie(issued.token)), 'unauthorized');
    expect((await store.read()).sessions).toEqual([]);
  });

  it('throttles the lastSeenAt write so a read is not usually a write', async () => {
    const clock = makeClock();
    const { planner, store, accessToken } = await setup(clock.now);
    const issued = await planner.signIn(accessToken);
    const initial = (await store.read()).sessions[0]!.lastSeenAt;

    clock.advanceMinutes(30);
    await planner.identify(withCookie(issued.token));
    expect((await store.read()).sessions[0]!.lastSeenAt).toBe(initial);

    clock.advanceMinutes(31);
    await planner.identify(withCookie(issued.token));
    expect((await store.read()).sessions[0]!.lastSeenAt).not.toBe(initial);
  });
});

describe('revocation', () => {
  it('rotating a token ends every session that token opened', async () => {
    const { planner, userId, accessToken } = await setup();
    const first = await planner.signIn(accessToken);
    const second = await planner.signIn(accessToken);

    const rotated = await planner.rotateUserToken(userId);

    // "Sign me out everywhere", which is what a leaked token needs.
    await expectCode(planner.identify(withCookie(first.token)), 'unauthorized');
    await expectCode(planner.identify(withCookie(second.token)), 'unauthorized');
    await expectCode(planner.identify(withBearer(accessToken)), 'unauthorized');

    const fresh = await planner.signIn(rotated.accessToken);
    expect((await planner.identify(withCookie(fresh.token))).userId).toBe(userId);
  });

  it('deleting a traveller takes their sessions with them', async () => {
    const planner = makePlanner();
    const issuedUser = await planner.createUser({
      handle: 'mai-nguyen',
      displayName: 'Mai',
    });
    const session = await planner.signIn(issuedUser.accessToken);

    await planner.deleteUser(issuedUser.user.id);

    await expectCode(planner.identify(withCookie(session.token)), 'unauthorized');
  });

  it('leaves another traveller’s sessions alone when one rotates', async () => {
    const planner = makePlanner();
    const mine = await makeOwner(planner, 'hung-tran');
    const theirs = await makeOwner(planner, 'mai-nguyen');
    const mySession = await planner.signIn(mine.token);
    const theirSession = await planner.signIn(theirs.token);

    await planner.rotateUserToken(mine.userId);

    await expectCode(planner.identify(withCookie(mySession.token)), 'unauthorized');
    expect((await planner.identify(withCookie(theirSession.token))).userId).toBe(
      theirs.userId,
    );
  });
});

describe('the cookie and the token coexist', () => {
  it('falls through to the bearer token when the cookie resolves to nothing', async () => {
    const { planner, userId, accessToken } = await setup();

    const request = new Request(BASE, {
      headers: {
        cookie: `${SESSION_COOKIE}=a-cookie-left-over-from-last-month`,
        authorization: `Bearer ${accessToken}`,
      },
    });

    // A stale cookie in a browser profile must not break a script.
    const identity = await planner.identify(request);
    expect(identity).toEqual({ userId, handle: 'hung-tran', source: 'bearer' });
  });

  it('reports an expired session rather than silently falling through', async () => {
    const clock = makeClock();
    const { planner, accessToken } = await setup(clock.now);
    const issued = await planner.signIn(accessToken);
    clock.advanceDays(20);

    const request = new Request(BASE, {
      headers: {
        cookie: `${SESSION_COOKIE}=${issued.token}`,
        authorization: `Bearer ${accessToken}`,
      },
    });

    // It resolved, so "your session expired" is more useful than pretending it
    // was never there — even with a usable token also attached.
    await expectCode(planner.identify(request), 'unauthorized');
  });

  it('ignores other cookies on the request', async () => {
    const { planner, userId, accessToken } = await setup();
    const issued = await planner.signIn(accessToken);

    const identity = await planner.identify(
      withCookie(issued.token, 'theme=dark; consent=necessary'),
    );
    expect(identity.userId).toBe(userId);
  });

  it('treats a session whose user vanished as no session at all', async () => {
    const { planner, store, accessToken } = await setup();
    const issued = await planner.signIn(accessToken);

    // Delete the user behind the repository's back, as a hand edit would.
    const data = await store.read();
    data.users = [];
    await store.write(data);

    await expectCode(planner.identify(withCookie(issued.token)), 'unauthorized');
    // And the meaningless row is cleaned up on the way out.
    expect((await store.read()).sessions).toEqual([]);
  });
});

describe('the integrity sweep covers sessions', () => {
  it('finds an orphan, an unswept expiry, a bad digest and a duplicate id', async () => {
    const clock = makeClock();
    const { planner, store, accessToken } = await setup(clock.now);
    await planner.signIn(accessToken);
    expect(await planner.validateIntegrity()).toEqual([]);

    const data = await store.read();
    const live = data.sessions[0]!;
    data.sessions.push({ ...live, id: 'ses_orphan', userId: 'usr_gone' });
    data.sessions.push({ ...live, id: 'ses_bad', tokenHash: 'not-a-digest' });
    data.sessions.push({ ...live, id: 'ses_orphan' });
    await store.write(data);

    const issues = await planner.validateIntegrity();
    const text = (id: string) =>
      issues.filter((issue) => issue.id === id).map((issue) => issue.issue);

    expect(text('ses_orphan').some((t) => t.includes('unknown user "usr_gone"'))).toBe(true);
    expect(text('ses_orphan').some((t) => t.includes('more than one row'))).toBe(true);
    expect(text('ses_bad').some((t) => t.includes('SHA-256 digest'))).toBe(true);

    // Nothing has signed in since, so the lapsed rows are still there.
    clock.advanceDays(20);
    const expired = await planner.validateIntegrity();
    expect(
      expired.filter((issue) => issue.issue.includes('expired and has not been swept')),
    ).not.toHaveLength(0);
  });
});
