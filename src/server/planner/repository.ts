import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  ContentError,
  forbidden,
  invalidReference,
  invalidState,
  notFound,
  preconditionRequired,
  slugConflict,
  versionConflict,
} from '@/server/content/errors';
import { userRole, type Role } from '@/server/identity/permissions';
import type { IntegrityIssue } from '@/server/content/repository';
import type { CostCategory, PlaceCategory } from '@/server/content/schemas';
import {
  authorizePlannerUser,
  findSessionByToken,
  findUserByAccessToken,
  hashAccessToken,
  hashSessionToken,
  issueAccessToken,
  issueSessionToken,
  sessionExpired,
  sessionTokenFromRequest,
  type PlannerIdentity,
} from './auth';
import { computeTripBudget, type TripBudgetSummary } from './budget';
import type { GoogleIdentity } from './google';
import {
  DEFAULT_SCRYPT_COST_LOG2,
  dummyPasswordHash,
  generateTemporaryPassword,
  hashPassword,
  parsePasswordHash,
  verifyPassword,
} from './password';
import type { PlannerCatalog } from './catalog';
import type { PlannerData, PlannerStore } from './store';
import {
  ACTIVITIES_PER_DAY_LIMIT,
  MAX_LIVE_OAUTH_ATTEMPTS,
  OAUTH_ATTEMPT_MINUTES,
  ADMIN_SESSION_ABSOLUTE_HOURS,
  ADMIN_SESSION_IDLE_HOURS,
  ADMIN_SESSION_TOUCH_INTERVAL_MINUTES,
  SESSION_ABSOLUTE_DAYS,
  SESSION_IDLE_DAYS,
  SESSION_TOUCH_INTERVAL_MINUTES,
  type OAuthAttempt,
  type PlannerReorderInput,
  type PlannerSession,
  type SessionMethod,
  type PlannerUser,
  type PlannerUserCreateInput,
  SHARE_TOKEN_PATTERN,
  type PublicPlannerUser,
  type ShareState,
  type SharedTripView,
  type TripDuplicateInput,
  type Visibility,
  type Trip,
  type TripActivity,
  type TripActivityCreateInput,
  type TripActivityUpdateInput,
  type TripCreateInput,
  type TripDay,
  type TripDayUpdateInput,
  type TripExpense,
  type TripExpenseCreateInput,
  type TripExpenseUpdateInput,
  type TripListQuery,
  type TripUpdateInput,
} from './schemas';

/**
 * All domain logic for the Planner core. The store below it only moves bytes;
 * the route handlers above it only parse payloads, carry the owner's identity
 * and map errors to status codes.
 *
 * Three invariants are owned here and nowhere else:
 *
 * 1. **A trip belongs to one owner.** Every read and every write is resolved
 *    through `requireOwnedTrip`, which answers 404 — not 403 — for somebody
 *    else's trip, so the API never confirms that an id exists to a caller who
 *    may not see it. This mirrors `getPublishedStory` in the content system.
 * 2. **Days are 1..n with no gaps, activities 0..m with no gaps.** Nothing
 *    accepts a day number or an order from the client as stored state; both are
 *    always re-derived from position.
 * 3. **`trip.version` advances on every mutation anywhere in the aggregate** —
 *    the trip row, a day, an activity, an expense. That single counter is what
 *    `If-Match` compares against, so an edit made against a stale read of *any*
 *    part of the trip is refused rather than silently applied.
 *
 * See `docs/adr/0002-planner-core.md`.
 */
export interface PlannerRepositoryOptions {
  store: PlannerStore;
  catalog: PlannerCatalog;
  /** Injected so tests get deterministic timestamps. */
  now?: () => Date;
  /** Injected so tests get deterministic ids. */
  newId?: (prefix: string) => string;
  /**
   * log2 of scrypt's N for new password hashes. Production uses the OWASP
   * baseline; tests pass a small value so a suite does not take minutes.
   */
  scryptCostLog2?: number;
}

/** A day with its activities attached, in order. */
export interface TripDayView extends TripDay {
  activities: TripActivity[];
}

/** Everything a client needs to render or restore a trip in one response. */
export interface TripView {
  trip: Trip;
  days: TripDayView[];
  expenses: TripExpense[];
  budget: TripBudgetSummary;
}

export interface IssuedPlannerUser {
  user: PublicPlannerUser;
  /** Shown exactly once. It is not stored and cannot be recovered. */
  accessToken: string;
}

export interface IssuedSession {
  user: PublicPlannerUser;
  /** The opaque cookie value. Only its digest is stored. */
  token: string;
  expiresAt: string;
}

export interface IssuedTemporaryPassword {
  user: PublicPlannerUser;
  /** Shown exactly once. Only its scrypt hash is stored. */
  temporaryPassword: string;
}

/** What `createUser` returns: the access token, and a password if an email was given. */
export interface IssuedPlannerUserWithPassword extends IssuedPlannerUser {
  temporaryPassword?: string;
}

/** A Google sign-in that did not resolve to an account (ADR 0007). */
export type GoogleSignInResult =
  | { ok: true; session: IssuedSession; created: boolean }
  | {
      ok: false;
      reason: 'account_not_found' | 'account_conflict' | 'link_required' | 'rate_limited';
    };

/** Linking Google to a signed-in user's own account (ADR 0007). */
export type GoogleLinkResult =
  | { ok: true; user: PublicPlannerUser }
  | { ok: false; reason: 'account_conflict' };

export interface NewOAuthAttempt {
  stateHash: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  locale: 'vi' | 'en';
  /** Present when a signed-in user is linking Google, not signing in. */
  linkUserId?: string;
}

export class PlannerRepository {
  private readonly store: PlannerStore;
  private readonly catalog: PlannerCatalog;
  private readonly now: () => Date;
  private readonly newId: (prefix: string) => string;
  private readonly scryptCostLog2: number;
  /**
   * SHA-256 (hex) of every live share token → trip id, so resolving a share
   * link is one map lookup instead of re-hashing every trip on every
   * unauthenticated request (and a wrong guess never reads the store at all).
   * Dropped on every write; `shareIndexGeneration` stops a read that raced a
   * write from caching an index built from the older snapshot.
   */
  private shareIndex: Map<string, string> | null = null;
  private shareIndexGeneration = 0;
  /** Store revision the index was built at, when the store reports one. */
  private shareIndexRevision: string | number | null = null;

  constructor(options: PlannerRepositoryOptions) {
    this.store = options.store;
    this.catalog = options.catalog;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? ((prefix) => `${prefix}_${randomUUID().slice(0, 8)}`);
    this.scryptCostLog2 = options.scryptCostLog2 ?? DEFAULT_SCRYPT_COST_LOG2;
  }

  // -------------------------------------------------------------------------
  // Transaction plumbing
  // -------------------------------------------------------------------------

  /**
   * Read, mutate, write — with every pair serialised behind one promise chain.
   * A throw inside `mutate` abandons the whole change: nothing is written, so a
   * failed validation can never leave half an activity behind.
   */
  /** Read-modify-write, made atomic by the store (ADR 0008 §3). */
  private async transaction<T>(mutate: (data: PlannerData) => Promise<T> | T): Promise<T> {
    // `withTripDefaults` fills the draft in place, so the defaults are written.
    const result = await this.store.transact((data) => mutate(withTripDefaults(data)));
    // Only after a successful write: a throw above leaves the index valid.
    this.shareIndex = null;
    this.shareIndexGeneration += 1;
    return result;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private async snapshot(): Promise<PlannerData> {
    return withTripDefaults(await this.store.read());
  }

  // -------------------------------------------------------------------------
  // Identity and users
  // -------------------------------------------------------------------------

  /**
   * Resolves a request to an identity — the one seam ADR 0004 §3 is built
   * around. The session cookie is tried first, then the bearer token.
   *
   * A cookie that resolves to nothing is not fatal: it falls through to the
   * bearer path, so a stale cookie left in a browser profile does not stop a
   * script that presents a valid token. An *expired* session is different — it
   * resolved, so saying 401 with a reason is more useful than pretending it was
   * never there — and it is swept on the way out.
   */
  async identify(request: Request): Promise<PlannerIdentity> {
    const presented = sessionTokenFromRequest(request);
    const data = await this.snapshot();

    if (presented) {
      const session = findSessionByToken(data.sessions, presented);
      if (session) {
        const now = this.now();
        const user = data.users.find((candidate) => candidate.id === session.userId);
        // The lifetime follows the role the user holds *now* (ADR 0010 §4).
        const role = user ? userRole(user) : 'member';
        if (sessionIsExpired(session, now, role)) {
          await this.dropSession(session.id);
          throw sessionExpired();
        }

        if (user) {
          if (sessionNeedsTouch(session, now, role)) await this.touchSession(session.id, now);
          // Only a session opened *with* the temporary password is held back
          // (ADR 0007): the same user signing in with Google is not.
          const pending = session.method === 'password' && user.mustChangePassword === true;
          return {
            userId: user.id,
            handle: user.handle,
            source: 'cookie',
            role: userRole(user),
            ...(pending ? { passwordChangeRequired: true } : {}),
          };
        }
        // The user is gone, so the session means nothing. Drop it and let the
        // bearer path decide.
        await this.dropSession(session.id);
      }
    }

    return authorizePlannerUser(request, data.users);
  }

  /**
   * Exchanges an access token for a browser session. The access token stays the
   * root credential — this adds a revocable, expiring handle on it, it does not
   * replace it.
   *
   * A new sign-in always issues a *new* session rather than extending an
   * existing one, so a second device does not silently inherit the first
   * device's remaining lifetime. Expired rows are swept while we are here,
   * which is the only sweep this store needs.
   */
  signIn(accessToken: string): Promise<IssuedSession> {
    return this.transaction((data) => {
      const user = findUserByAccessToken(data.users, accessToken);
      if (!user) {
        throw new ContentError('unauthorized', 'that access token is not valid');
      }

      return this.openSession(data, user, 'token');
    });
  }

  /**
   * Adds a session row for `user` inside a transaction the caller holds. A new
   * sign-in always issues a *new* session rather than extending an existing
   * one, and expired rows are swept while we are here.
   */
  private openSession(data: PlannerData, user: PlannerUser, method: SessionMethod): IssuedSession {
    const now = this.now();
    const at = now.toISOString();
    const token = issueSessionToken();
    const session: PlannerSession = {
      id: this.newId('ses'),
      tokenHash: hashSessionToken(token),
      userId: user.id,
      createdAt: at,
      lastSeenAt: at,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_DAYS * DAY_MS).toISOString(),
      method,
    };

    data.sessions = data.sessions.filter(
      (candidate) => !sessionIsExpired(candidate, now, roleOfSessionUser(data, candidate)),
    );
    data.sessions.push(session);

    return { user: toPublicUser(user), token, expiresAt: session.expiresAt };
  }

  // -------------------------------------------------------------------------
  // Passwords (ADR 0007)
  // -------------------------------------------------------------------------

  /**
   * Email + password sign-in. Every failure — unknown email, no password set,
   * wrong password — is the same 401 with the same message, and an unknown
   * email still pays for one scrypt run, so neither the answer nor its timing
   * says whether an account exists.
   *
   * scrypt runs *outside* the store transaction (it is deliberately slow and
   * must not hold the write queue); the transaction then re-checks that the
   * hash it verified is still the stored one, so a password changed in between
   * cannot be signed in with.
   */
  async signInWithPassword(email: string, password: string): Promise<IssuedSession> {
    const refused = () => new ContentError('unauthorized', 'that email and password do not match');
    const data = await this.snapshot();
    const candidate = data.users.find((user) => user.email === email) ?? null;
    const stored = candidate?.passwordHash ?? null;

    const check = await verifyPassword(
      password,
      stored ?? dummyPasswordHash(this.scryptCostLog2),
      this.scryptCostLog2,
    );
    if (!candidate || !stored || !check.ok) throw refused();

    const upgraded = check.needsRehash ? await hashPassword(password, this.scryptCostLog2) : null;

    return this.transaction((current) => {
      const user = current.users.find((row) => row.id === candidate.id);
      if (!user || user.passwordHash !== stored) throw refused();
      if (upgraded) user.passwordHash = upgraded;
      return this.openSession(current, user, 'password');
    });
  }

  /**
   * Changes the signed-in user's own password. Clears the temporary-password
   * flag and ends every *other* session of that user; the one making the
   * change stays signed in.
   */
  async changePassword(
    request: Request,
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const data = await this.snapshot();
    const user = data.users.find((row) => row.id === userId);
    if (!user) throw new ContentError('unauthorized', 'this credential is not valid');
    const stored = user.passwordHash ?? null;
    if (!stored) {
      throw invalidState('this account has no password; an operator can issue one');
    }
    const check = await verifyPassword(currentPassword, stored, this.scryptCostLog2);
    if (!check.ok) {
      throw new ContentError('validation_failed', 'the current password is not correct', [
        { path: 'currentPassword', message: 'is not correct' },
      ]);
    }
    if (currentPassword === newPassword) {
      throw new ContentError('validation_failed', 'the new password must differ from the current one', [
        { path: 'newPassword', message: 'must differ from the current password' },
      ]);
    }
    const nextHash = await hashPassword(newPassword, this.scryptCostLog2);
    const presented = sessionTokenFromRequest(request);

    await this.transaction((current) => {
      const row = current.users.find((candidate) => candidate.id === userId);
      if (!row || row.passwordHash !== stored) {
        throw invalidState('the password changed while this request was in flight — try again');
      }
      row.passwordHash = nextHash;
      row.mustChangePassword = false;
      row.updatedAt = this.timestamp();
      const keep = presented ? findSessionByToken(current.sessions, presented) : null;
      current.sessions = current.sessions.filter(
        (session) => session.userId !== userId || session.id === keep?.id,
      );
    });
  }

  /**
   * Operator reset: a new temporary password, shown once, and every session of
   * that user ended — the same "sign out everywhere" as `rotate-token`.
   */
  async resetUserPassword(
    userId: string,
    actor?: AdminActor,
  ): Promise<IssuedTemporaryPassword> {
    // A session principal resets its own password through the change-password
    // page, not here (ADR 0010 §6). Checked before the slow hash.
    if (actor && actor.userId === userId) throw selfAdminAction('reset its own password');
    const temporaryPassword = generateTemporaryPassword();
    const hash = await hashPassword(temporaryPassword, this.scryptCostLog2);
    return this.transaction((data) => {
      assertActorStillAdmin(data, actor);
      const user = data.users.find((row) => row.id === userId);
      if (!user) throw notFound('planner user', userId);
      if (!user.email) {
        throw invalidState(`planner user "${userId}" has no email, so cannot sign in with a password`);
      }
      user.passwordHash = hash;
      user.mustChangePassword = true;
      user.updatedAt = this.timestamp();
      data.sessions = data.sessions.filter((session) => session.userId !== userId);
      return { user: toPublicUser(user), temporaryPassword };
    });
  }

  // -------------------------------------------------------------------------
  // Google (ADR 0007)
  // -------------------------------------------------------------------------

  /**
   * Records an in-flight Google sign-in; sweeps expired ones on the way.
   * Answers false — and writes nothing — when `MAX_LIVE_OAUTH_ATTEMPTS` are
   * already in flight, so a flood of starts cannot grow the store without
   * bound whatever address it claims to come from.
   */
  beginGoogleSignIn(attempt: NewOAuthAttempt): Promise<boolean> {
    return this.transaction((data) => {
      const now = this.now();
      data.oauthAttempts = data.oauthAttempts.filter(
        (row) => Date.parse(row.expiresAt) > now.getTime(),
      );
      if (data.oauthAttempts.length >= MAX_LIVE_OAUTH_ATTEMPTS) return false;
      data.oauthAttempts.push({
        id: this.newId('oau'),
        ...attempt,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + OAUTH_ATTEMPT_MINUTES * 60_000).toISOString(),
      });
      return true;
    });
  }

  /**
   * Takes the attempt a `state` belongs to, **removing it whatever happens
   * next** — a `state` is good for one callback only. Null if unknown or
   * expired.
   */
  consumeGoogleAttempt(stateHash: string): Promise<OAuthAttempt | null> {
    return this.transaction((data) => {
      const now = this.now().getTime();
      let found: OAuthAttempt | null = null;
      for (const row of data.oauthAttempts) {
        if (digestsMatch(row.stateHash, stateHash)) found = row;
      }
      data.oauthAttempts = data.oauthAttempts.filter(
        (row) => row !== found && Date.parse(row.expiresAt) > now,
      );
      if (!found || Date.parse(found.expiresAt) <= now) return null;
      return found;
    });
  }

  /**
   * Resolves a verified Google identity to an account, in one transaction so
   * two concurrent first sign-ins cannot create two accounts:
   * 1. a user with this `sub` — signed in; 2. else a user with this email —
   * refused, `link_required` when it has no Google link yet and
   * `account_conflict` when it is linked to another `sub`; 3. else a new
   * account, if signup is enabled.
   *
   * Step 2 never links. An email an operator typed was never verified: a typo
   * or a recycled address would otherwise hand the account, and its trips, to
   * whoever controls that Google account. The owner links Google themselves
   * from a signed-in session (`linkGoogle`).
   */
  signInWithGoogle(
    identity: GoogleIdentity,
    options: {
      signupEnabled: boolean;
      /**
       * Asked only when an account would be *created*, so the signup limiter
       * counts creations, not every Google sign-in.
       */
      allowSignup?: () => boolean;
    },
  ): Promise<GoogleSignInResult> {
    return this.transaction((data): GoogleSignInResult => {
      const bySub = data.users.find((user) => user.googleSub === identity.sub);
      if (bySub) return { ok: true, session: this.openSession(data, bySub, 'google'), created: false };

      const byEmail = data.users.find((user) => user.email === identity.email);
      if (byEmail) {
        return { ok: false, reason: byEmail.googleSub ? 'account_conflict' : 'link_required' };
      }

      if (!options.signupEnabled) return { ok: false, reason: 'account_not_found' };
      if (options.allowSignup && !options.allowSignup()) return { ok: false, reason: 'rate_limited' };

      const at = this.timestamp();
      const user: PlannerUser = {
        id: this.newId('usr'),
        handle: uniqueHandle(identity.email, data.users),
        displayName: displayNameFor(identity),
        // A token is required by the schema; this one is never shown to
        // anyone. An operator can rotate it if the user ever needs one.
        tokenHash: hashAccessToken(issueAccessToken()),
        createdAt: at,
        updatedAt: at,
        email: identity.email,
        passwordHash: null,
        googleSub: identity.sub,
        createdVia: 'google',
        role: 'member',
      };
      data.users.push(user);
      return { ok: true, session: this.openSession(data, user, 'google'), created: true };
    });
  }

  /**
   * Links a verified Google identity to `userId` — the user who started the
   * flow from a signed-in session, re-checked by the callback. The Google
   * email need not match the account's: proving control of both is the point.
   * Refused if this Google account already belongs to someone else, or the
   * user is already linked to a different one. Existing sessions survive.
   */
  linkGoogle(userId: string, identity: GoogleIdentity): Promise<GoogleLinkResult> {
    return this.transaction((data): GoogleLinkResult => {
      const user = data.users.find((row) => row.id === userId);
      if (!user) throw notFound('planner user', userId);
      const holder = data.users.find((row) => row.googleSub === identity.sub);
      if (holder && holder.id !== userId) return { ok: false, reason: 'account_conflict' };
      if (user.googleSub && user.googleSub !== identity.sub) {
        return { ok: false, reason: 'account_conflict' };
      }
      if (user.googleSub !== identity.sub) {
        user.googleSub = identity.sub;
        user.updatedAt = this.timestamp();
      }
      return { ok: true, user: toPublicUser(user) };
    });
  }

  /** Removes the Google link and ends that user's sessions. */
  unlinkGoogle(userId: string): Promise<PublicPlannerUser> {
    return this.transaction((data) => {
      const user = data.users.find((row) => row.id === userId);
      if (!user) throw notFound('planner user', userId);
      user.googleSub = null;
      user.updatedAt = this.timestamp();
      data.sessions = data.sessions.filter((session) => session.userId !== userId);
      return toPublicUser(user);
    });
  }

  /**
   * Ends the session the request carries. Idempotent: signing out twice, or
   * with no cookie at all, succeeds — a client retrying a sign-out must not get
   * an error for having already succeeded.
   */
  signOut(request: Request): Promise<void> {
    const presented = sessionTokenFromRequest(request);
    return this.transaction((data) => {
      if (!presented) return;
      const session = findSessionByToken(data.sessions, presented);
      if (session) {
        data.sessions = data.sessions.filter(
          (candidate) => candidate.id !== session.id,
        );
      }
    });
  }

  private dropSession(sessionId: string): Promise<void> {
    return this.transaction((data) => {
      data.sessions = data.sessions.filter((session) => session.id !== sessionId);
    });
  }

  private touchSession(sessionId: string, now: Date): Promise<void> {
    return this.transaction((data) => {
      const session = data.sessions.find((candidate) => candidate.id === sessionId);
      if (session) session.lastSeenAt = now.toISOString();
    });
  }

  async listUsers(): Promise<PublicPlannerUser[]> {
    const data = await this.snapshot();
    return [...data.users]
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .map(toPublicUser);
  }

  /**
   * Provisions a traveller and issues their one and only access token. With an
   * email, a temporary password is issued too (ADR 0007), shown once, and the
   * user must change it before using the Planner.
   */
  async createUser(input: PlannerUserCreateInput): Promise<IssuedPlannerUserWithPassword> {
    const temporaryPassword = input.email ? generateTemporaryPassword() : null;
    const passwordHash = temporaryPassword
      ? await hashPassword(temporaryPassword, this.scryptCostLog2)
      : null;

    return this.transaction((data) => {
      if (data.users.some((user) => user.handle === input.handle)) {
        throw slugConflict('planner user', input.handle);
      }
      if (input.email && data.users.some((user) => user.email === input.email)) {
        // The address is not echoed back: it is personal data.
        throw new ContentError('slug_conflict', 'another planner user already has that email');
      }
      const at = this.timestamp();
      const accessToken = issueAccessToken();
      const user: PlannerUser = {
        id: this.newId('usr'),
        handle: input.handle,
        displayName: input.displayName,
        tokenHash: hashAccessToken(accessToken),
        createdAt: at,
        updatedAt: at,
        ...(input.role ? { role: input.role } : {}),
        ...(input.email
          ? { email: input.email, passwordHash, mustChangePassword: true, createdVia: 'operator' as const }
          : {}),
      };
      data.users.push(user);
      return temporaryPassword
        ? { user: toPublicUser(user), accessToken, temporaryPassword }
        : { user: toPublicUser(user), accessToken };
    });
  }

  /**
   * Sets a user's role. Idempotent: the same role again changes nothing, not
   * even `updatedAt`. Sessions are not touched — `identify` reads the role per
   * request, so the change applies at once.
   */
  setUserRole(userId: string, role: Role, actor?: AdminActor): Promise<PublicPlannerUser> {
    if (actor && actor.userId === userId) {
      return Promise.reject(selfAdminAction('change its own role'));
    }
    return this.transaction((data) => {
      assertActorStillAdmin(data, actor);
      const index = data.users.findIndex((user) => user.id === userId);
      const existing = data.users[index];
      if (index < 0 || !existing) throw notFound('planner user', userId);
      if (userRole(existing) === role) return toPublicUser(existing);
      // Never leave the system without an admin — the service token is held to
      // this too (ADR 0010 §6).
      if (userRole(existing) === 'admin') assertAnotherAdminExists(data, userId, 'demote');
      const next: PlannerUser = { ...existing, role, updatedAt: this.timestamp() };
      data.users[index] = next;
      return toPublicUser(next);
    });
  }

  /** Replaces the token — the previous one stops working immediately. */
  rotateUserToken(userId: string): Promise<IssuedPlannerUser> {
    return this.transaction((data) => {
      const index = data.users.findIndex((user) => user.id === userId);
      const existing = data.users[index];
      if (index < 0 || !existing) throw notFound('planner user', userId);

      const accessToken = issueAccessToken();
      const next: PlannerUser = {
        ...existing,
        tokenHash: hashAccessToken(accessToken),
        updatedAt: this.timestamp(),
      };
      data.users[index] = next;
      // Rotation is the "sign me out everywhere" control (ADR 0004 §5): the old
      // token is dead, and so is every session that was opened with it.
      data.sessions = data.sessions.filter((session) => session.userId !== userId);
      return { user: toPublicUser(next), accessToken };
    });
  }

  /** Refuses while the traveller still has trips — their data is not collateral. */
  deleteUser(userId: string): Promise<void> {
    return this.transaction((data) => {
      const index = data.users.findIndex((user) => user.id === userId);
      const target = data.users[index];
      if (index < 0 || !target) throw notFound('planner user', userId);
      if (userRole(target) === 'admin') assertAnotherAdminExists(data, userId, 'delete');

      const trips = data.trips.filter((trip) => trip.ownerId === userId).length;
      if (trips > 0) {
        throw invalidState(
          `planner user "${userId}" still owns ${trips} trip(s) — delete or reassign them first`,
        );
      }
      data.users.splice(index, 1);
      data.sessions = data.sessions.filter((session) => session.userId !== userId);
    });
  }

  // -------------------------------------------------------------------------
  // Object-level authorization
  // -------------------------------------------------------------------------

  /**
   * The single gate on every trip-scoped operation. Someone else's trip is
   * indistinguishable from one that does not exist.
   */
  private static requireOwnedTrip(
    data: PlannerData,
    ownerId: string,
    tripId: string,
  ): { trip: Trip; index: number } {
    const index = data.trips.findIndex((trip) => trip.id === tripId);
    const trip = data.trips[index];
    if (index < 0 || !trip || trip.ownerId !== ownerId) throw notFound('trip', tripId);
    return { trip, index };
  }

  /**
   * Optimistic concurrency. `expected` is the version the caller last read.
   *
   * `required` is true for every mutation of existing state: without
   * `If-Match`, two tabs editing the same trip would both write and the slower
   * one would win silently. Appends pass `false` — adding an activity is not a
   * lost update — but still verify the version when one is supplied.
   */
  private static requireVersion(trip: Trip, expected: number | null, required: boolean): void {
    if (expected === null) {
      if (!required) return;
      throw preconditionRequired(
        `this change needs an "If-Match: \\"<version>\\"" header — trip "${trip.id}" is at version ${trip.version}`,
      );
    }
    if (expected !== trip.version) {
      throw versionConflict(`trip "${trip.id}"`, expected, trip.version);
    }
  }

  /** An archived trip is readable and restorable, but not editable. */
  private static requireActive(trip: Trip): void {
    if (trip.status === 'archived') {
      throw invalidState(
        `trip "${trip.id}" is archived — restore it before editing`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Trips
  // -------------------------------------------------------------------------

  /**
   * The traveller's own trips. With no `status` filter this lists active trips
   * only — an archived trip is out of the way by design, and `?status=archived`
   * is how you go and find it again.
   */
  async listTrips(ownerId: string, query: Partial<TripListQuery> = {}): Promise<Trip[]> {
    const data = await this.snapshot();
    const wanted = query.status ?? 'active';
    let trips = data.trips.filter(
      (trip) => trip.ownerId === ownerId && trip.status === wanted,
    );
    if (query.destinationSlug) {
      trips = trips.filter((trip) => trip.destinationSlug === query.destinationSlug);
    }
    // Soonest departure first; undated trips last, newest of them first.
    trips.sort((a, b) => {
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      if (a.startDate) return -1;
      if (b.startDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return trips.slice(offset, offset + limit);
  }

  /** The whole trip in one read: days, activities, expenses and the budget. */
  async getTrip(ownerId: string, tripId: string): Promise<TripView> {
    const data = await this.snapshot();
    const { trip } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
    return buildTripView(data, trip);
  }

  async getBudget(ownerId: string, tripId: string): Promise<TripBudgetSummary> {
    const { budget } = await this.getTrip(ownerId, tripId);
    return budget;
  }

  /**
   * Creates a trip and its days in one transaction — a trip with no days has
   * never existed and cannot be observed.
   */
  createTrip(ownerId: string, input: TripCreateInput): Promise<TripView> {
    return this.transaction(async (data) => {
      if (!data.users.some((user) => user.id === ownerId)) {
        throw notFound('planner user', ownerId);
      }

      const at = this.timestamp();
      const tripId = this.newId('trip');
      const draft =
        input.source === 'template'
          ? await this.fromTemplate(input, tripId, at)
          : await this.fromBlank(input, tripId, at);

      const trip: Trip = {
        id: tripId,
        ownerId,
        title: draft.title,
        destinationSlug: draft.destinationSlug,
        startDate: input.startDate ?? null,
        endDate: endDateFor(input.startDate ?? null, draft.durationDays),
        durationDays: draft.durationDays,
        partySize: input.partySize,
        travelStyle: draft.travelStyle,
        pace: draft.pace,
        budget: { targetTotalVnd: input.budget.targetTotalVnd, currency: 'VND' },
        note: input.note,
        status: 'active',
        archivedAt: null,
        sourceTemplate: draft.sourceTemplate,
        planningStatus: 'draft',
        visibility: 'private',
        shareToken: null,
        shareTokenCreatedAt: null,
        duplicatedFromTripId: null,
        version: 1,
        createdAt: at,
        updatedAt: at,
      };

      data.trips.push(trip);
      data.tripDays.push(...draft.days);
      data.tripActivities.push(...draft.activities);
      return buildTripView(data, trip);
    });
  }

  /** A trip planned from scratch: empty days, numbered 1..n. */
  private async fromBlank(
    input: Extract<TripCreateInput, { source: 'blank' }>,
    tripId: string,
    at: string,
  ): Promise<TripDraft> {
    if (!this.catalog.hasDestination(input.destinationSlug)) {
      throw invalidReference([
        {
          path: 'destinationSlug',
          message: `destination "${input.destinationSlug}" does not exist`,
        },
      ]);
    }

    return {
      title: input.title,
      destinationSlug: input.destinationSlug,
      durationDays: input.durationDays,
      travelStyle: input.travelStyle,
      pace: input.pace,
      sourceTemplate: null,
      days: this.buildDays(tripId, input.durationDays, input.startDate, at, []),
      activities: [],
    };
  }

  /**
   * A trip cloned from an approved template.
   *
   * The clone is a **snapshot, not a reference**: every day and activity is a
   * new row with a new id, owned by this trip. The template is read once and
   * never written to, which the read-only `PlannerCatalog` makes structural.
   * Editing the trip afterwards cannot reach the template, and a later edit to
   * the template cannot reach the trip — `sourceTemplate` keeps the provenance
   * and the template's version so staleness stays visible (ADR 0002 §4).
   */
  private async fromTemplate(
    input: Extract<TripCreateInput, { source: 'template' }>,
    tripId: string,
    at: string,
  ): Promise<TripDraft> {
    const template = await this.catalog.getApprovedTemplate(input.templateSlug);
    if (!template) {
      throw invalidReference([
        {
          path: 'templateSlug',
          message: `approved template "${input.templateSlug}" does not exist — only a public template can be cloned`,
        },
      ]);
    }

    const destinationSlug = template.sourceSnapshot.destinationSlug;
    // ADR 0012 made a story's destination nullable; a trip still needs one.
    if (destinationSlug === null) {
      throw invalidState(
        `template "${template.slug}" comes from a story with no destination and cannot be cloned into a trip`,
      );
    }
    if (!this.catalog.hasDestination(destinationSlug)) {
      throw invalidState(
        `template "${template.slug}" points at destination "${destinationSlug}", which no longer exists`,
      );
    }

    // Resolve every referenced place once, so each activity's cost category can
    // be inferred without a lookup per row.
    const categoryBySlug = new Map<string, PlaceCategory>();
    for (const slug of template.placeSlugs) {
      const place = await this.catalog.getPlace(slug);
      if (place) categoryBySlug.set(place.slug, place.category);
    }

    const days = this.buildDays(
      tripId,
      template.durationDays,
      input.startDate ?? null,
      at,
      template.days.map((day) => ({ title: day.title.vi, note: day.summary?.vi ?? null })),
    );

    const activities: TripActivity[] = [];
    template.days.forEach((templateDay, dayIndex) => {
      const day = days[dayIndex];
      if (!day) return;
      templateDay.activities.forEach((source, order) => {
        activities.push({
          id: this.newId('act'),
          tripId,
          dayId: day.id,
          order,
          placeSlug: source.placeSlug,
          title: source.title.vi,
          startTime: source.startTime,
          durationMinutes: source.durationMinutes,
          estimatedCostVnd: source.estimatedCostVnd,
          // A template's figures describe the party the template was written
          // for, as one bill — not a rate per head.
          costScope: 'group',
          category: inferCostCategory(
            source.placeSlug ? categoryBySlug.get(source.placeSlug) : undefined,
          ),
          note: source.note?.vi ?? null,
          createdAt: at,
          updatedAt: at,
        });
      });
    });

    return {
      title: input.title ?? template.title.vi,
      destinationSlug,
      durationDays: template.durationDays,
      travelStyle: input.travelStyle !== undefined ? input.travelStyle : template.travelStyle,
      pace: input.pace !== undefined ? input.pace : template.pace,
      sourceTemplate: {
        templateSlug: template.slug,
        title: template.title,
        templateVersion: template.version,
        durationDays: template.durationDays,
        estimatedTotalVnd: template.estimatedTotalVnd,
        clonedAt: at,
        story: await this.catalog.getLinkedStory(template.slug),
      },
      days,
      activities,
    };
  }

  /**
   * Updates the trip header. Changing `durationDays` adds or removes days;
   * changing `startDate` re-dates every day, so "day 2" never drifts off its
   * calendar date.
   */
  updateTrip(
    ownerId: string,
    tripId: string,
    patch: TripUpdateInput,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      PlannerRepository.requireActive(trip);

      const durationDays = patch.durationDays ?? trip.durationDays;
      const startDate = patch.startDate !== undefined ? patch.startDate : trip.startDate;
      const at = this.timestamp();

      if (durationDays < trip.durationDays) {
        this.dropDays(data, trip, durationDays);
      } else if (durationDays > trip.durationDays) {
        const added = this.buildDays(trip.id, durationDays, startDate, at, []).slice(
          trip.durationDays,
        );
        data.tripDays.push(...added);
      }

      // Re-date in place: ids and content survive, only the calendar moves.
      for (const day of data.tripDays) {
        if (day.tripId !== trip.id) continue;
        const date = dayDate(startDate, day.dayNumber);
        if (day.date !== date) {
          day.date = date;
          day.updatedAt = at;
        }
      }

      const next = this.touch(data, index, trip, {
        title: patch.title ?? trip.title,
        startDate,
        endDate: endDateFor(startDate, durationDays),
        durationDays,
        partySize: patch.partySize ?? trip.partySize,
        travelStyle: patch.travelStyle !== undefined ? patch.travelStyle : trip.travelStyle,
        pace: patch.pace !== undefined ? patch.pace : trip.pace,
        budget: patch.budget
          ? { targetTotalVnd: patch.budget.targetTotalVnd, currency: 'VND' }
          : trip.budget,
        note: patch.note !== undefined ? patch.note : trip.note,
        planningStatus: patch.planningStatus ?? trip.planningStatus,
      });
      return buildTripView(data, next);
    });
  }

  /** Shrinking a trip may not silently destroy planned days. */
  private dropDays(data: PlannerData, trip: Trip, durationDays: number): void {
    const doomed = data.tripDays.filter(
      (day) => day.tripId === trip.id && day.dayNumber > durationDays,
    );
    const doomedIds = new Set(doomed.map((day) => day.id));
    const blocking = [
      ...data.tripActivities
        .filter((activity) => doomedIds.has(activity.dayId))
        .map((activity) => `activity:${activity.id}`),
      ...data.tripExpenses
        .filter((expense) => expense.dayId !== null && doomedIds.has(expense.dayId))
        .map((expense) => `expense:${expense.id}`),
    ];
    if (blocking.length > 0) {
      throw invalidState(
        `cannot shorten trip "${trip.id}" to ${durationDays} day(s): day ${durationDays + 1} onwards still holds ${blocking.join(', ')}`,
      );
    }
    data.tripDays = data.tripDays.filter((day) => !doomedIds.has(day.id));
  }

  /**
   * Soft delete. The trip and everything under it stay exactly as they were —
   * this is the "lưu và khôi phục" half of saving a trip, and it is what
   * `DELETE /api/planner/:id` does, so a mis-click costs one request to undo.
   *
   * The one thing archiving does *not* keep is a share link. Archiving already
   * hides it, and restoring must not silently bring back a link the owner may
   * have forgotten was out there — so the trip comes back private, and sharing
   * it again mints a fresh token.
   */
  archiveTrip(ownerId: string, tripId: string, expectedVersion: number | null): Promise<Trip> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      if (trip.status === 'archived') {
        throw invalidState(`trip "${tripId}" is already archived`);
      }
      return this.touch(data, index, trip, {
        status: 'archived',
        archivedAt: this.timestamp(),
        visibility: 'private',
        shareToken: null,
        shareTokenCreatedAt: null,
      });
    });
  }

  /** Brings an archived trip back, private (see `archiveTrip`). */
  restoreTrip(ownerId: string, tripId: string, expectedVersion: number | null): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      if (trip.status !== 'archived') {
        throw invalidState(`trip "${tripId}" is not archived`);
      }
      // Also cleared here for trips archived before archiving revoked links.
      const next = this.touch(data, index, trip, {
        status: 'active',
        archivedAt: null,
        visibility: 'private',
        shareToken: null,
        shareTokenCreatedAt: null,
      });
      return buildTripView(data, next);
    });
  }

  /**
   * Permanent delete, with the trip and every row under it. Deliberately a
   * two-step: a trip must be archived first, so nothing a traveller can reach
   * in one request destroys a plan outright.
   */
  purgeTrip(ownerId: string, tripId: string, expectedVersion: number | null): Promise<void> {
    return this.transaction((data) => {
      const { trip } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      if (trip.status !== 'archived') {
        throw invalidState(
          `trip "${tripId}" must be archived before it can be deleted permanently`,
        );
      }
      data.trips = data.trips.filter((row) => row.id !== tripId);
      data.tripDays = data.tripDays.filter((row) => row.tripId !== tripId);
      data.tripActivities = data.tripActivities.filter((row) => row.tripId !== tripId);
      data.tripExpenses = data.tripExpenses.filter((row) => row.tripId !== tripId);
    });
  }

  // -------------------------------------------------------------------------
  // Duplicate and sharing (ADR 0005)
  // -------------------------------------------------------------------------

  /**
   * An independent copy of an active trip: new ids on every row, a draft,
   * private, no token. The source is only read — never written.
   */
  duplicateTrip(
    ownerId: string,
    tripId: string,
    input: TripDuplicateInput = {},
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireActive(trip);

      const at = this.timestamp();
      const copyId = this.newId('trip');
      const dayIds = new Map<string, string>();
      const activityIds = new Map<string, string>();

      const days: TripDay[] = data.tripDays
        .filter((day) => day.tripId === trip.id)
        .map((day) => {
          const id = this.newId('day');
          dayIds.set(day.id, id);
          return { ...day, id, tripId: copyId, createdAt: at, updatedAt: at };
        });
      const activities: TripActivity[] = [];
      for (const activity of data.tripActivities.filter((row) => row.tripId === trip.id)) {
        const id = this.newId('act');
        activityIds.set(activity.id, id);
        activities.push({
          ...activity,
          id,
          tripId: copyId,
          dayId: dayIds.get(activity.dayId) ?? activity.dayId,
          createdAt: at,
          updatedAt: at,
        });
      }
      const expenses: TripExpense[] = data.tripExpenses
        .filter((row) => row.tripId === trip.id)
        .map((expense) => ({
          ...expense,
          id: this.newId('exp'),
          tripId: copyId,
          dayId: expense.dayId === null ? null : (dayIds.get(expense.dayId) ?? null),
          activityId:
            expense.activityId === null ? null : (activityIds.get(expense.activityId) ?? null),
          createdAt: at,
          updatedAt: at,
        }));

      const copy: Trip = {
        ...structuredClone(trip),
        id: copyId,
        title: input.title ?? `${trip.title} (bản sao)`.slice(0, 120),
        status: 'active',
        archivedAt: null,
        planningStatus: 'draft',
        visibility: 'private',
        shareToken: null,
        shareTokenCreatedAt: null,
        duplicatedFromTripId: trip.id,
        version: 1,
        createdAt: at,
        updatedAt: at,
      };

      data.trips.push(copy);
      data.tripDays.push(...days);
      data.tripActivities.push(...activities);
      data.tripExpenses.push(...expenses);
      return buildTripView(data, copy);
    });
  }

  /**
   * Sets who may read the trip. Non-private mints a token if there is none and
   * otherwise keeps it (idempotent); `private` clears it, which is a revoke.
   * Not a content edit: it does not bump `version`, so a share change never
   * makes the owner's open editor stale.
   */
  setVisibility(ownerId: string, tripId: string, visibility: Visibility): Promise<ShareState> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireActive(trip);

      let { shareToken, shareTokenCreatedAt } = trip;
      if (visibility === 'private') {
        shareToken = null;
        shareTokenCreatedAt = null;
      } else if (shareToken === null) {
        shareToken = newShareToken();
        shareTokenCreatedAt = this.timestamp();
      }
      data.trips[index] = { ...trip, visibility, shareToken, shareTokenCreatedAt };
      return { visibility, shareToken, shareTokenCreatedAt };
    });
  }

  /** Replaces the token; the old link stops working at once. */
  rotateShareToken(ownerId: string, tripId: string): Promise<ShareState> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireActive(trip);
      if (trip.visibility === 'private') {
        throw invalidState(`trip "${tripId}" is private — share it before rotating the link`);
      }
      const shareToken = newShareToken();
      const shareTokenCreatedAt = this.timestamp();
      data.trips[index] = { ...trip, shareToken, shareTokenCreatedAt };
      return { visibility: trip.visibility, shareToken, shareTokenCreatedAt };
    });
  }

  /** Makes the trip private and kills the link. Idempotent. */
  revokeShare(ownerId: string, tripId: string): Promise<ShareState> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      data.trips[index] = {
        ...trip,
        visibility: 'private',
        shareToken: null,
        shareTokenCreatedAt: null,
      };
      return { visibility: 'private', shareToken: null, shareTokenCreatedAt: null };
    });
  }

  /**
   * Resolves a share link to a read-only view, or null. Null is the answer for
   * every failure — malformed, unknown, revoked, private, archived — so a caller
   * cannot tell them apart. The format is checked before any lookup; the
   * candidate's digest is looked up in the cached share index, and a hit is
   * re-checked against a fresh read and compared in constant time.
   */
  async getSharedTrip(token: string): Promise<SharedTripView | null> {
    if (typeof token !== 'string' || !SHARE_TOKEN_PATTERN.test(token)) return null;

    const index = await this.loadShareIndex();
    const tripId = index.get(shareTokenDigest(token));
    if (tripId === undefined) return null;

    // The index only narrows the search. The decision is always re-made
    // against a fresh read, so a token revoked or rotated since the index was
    // built can never resolve.
    const data = await this.snapshot();
    const trip = data.trips.find((candidate) => candidate.id === tripId);
    if (!trip || !isShareable(trip)) return null;
    const stored = Buffer.from(shareTokenDigest(trip.shareToken), 'hex');
    const presented = Buffer.from(shareTokenDigest(token), 'hex');
    if (!timingSafeEqual(stored, presented)) return null;

    return buildSharedView(buildTripView(data, trip), trip.visibility);
  }

  private async loadShareIndex(): Promise<Map<string, string>> {
    // A shared store can change under another process: compare its revision.
    // Read before the snapshot, so the index is never tagged newer than its data.
    const revision = (await this.store.revision?.()) ?? null;
    if (this.shareIndex && revision === this.shareIndexRevision) return this.shareIndex;

    const generation = this.shareIndexGeneration;
    const data = await this.snapshot();
    const index = new Map<string, string>();
    for (const trip of data.trips) {
      if (isShareable(trip)) index.set(shareTokenDigest(trip.shareToken), trip.id);
    }
    // A write landed while we were reading: use this index once, don't keep it.
    if (generation === this.shareIndexGeneration) {
      this.shareIndex = index;
      this.shareIndexRevision = revision;
    }
    return index;
  }

  /** Session details for `GET /api/planner/session`. Never returns a credential. */
  async describeSession(
    request: Request,
    userId: string,
  ): Promise<{
    user: PublicPlannerUser;
    expiresAt: string | null;
    passwordChangeRequired: boolean;
  }> {
    const data = await this.snapshot();
    const user = data.users.find((candidate) => candidate.id === userId);
    if (!user) throw new ContentError('unauthorized', 'this credential is not valid');

    const presented = sessionTokenFromRequest(request);
    const found = presented ? findSessionByToken(data.sessions, presented) : null;
    const session = found && found.userId === userId ? found : null;
    return {
      user: toPublicUser(user),
      expiresAt: session ? session.expiresAt : null,
      passwordChangeRequired: session?.method === 'password' && user.mustChangePassword === true,
    };
  }

  // -------------------------------------------------------------------------
  // Days
  // -------------------------------------------------------------------------

  /** Days carry a title and a note; their number and date are never set by hand. */
  updateDay(
    ownerId: string,
    tripId: string,
    dayNumber: number,
    patch: TripDayUpdateInput,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      PlannerRepository.requireActive(trip);

      const day = data.tripDays.find(
        (row) => row.tripId === tripId && row.dayNumber === dayNumber,
      );
      if (!day) throw notFound(`trip "${tripId}" day`, String(dayNumber));

      const at = this.timestamp();
      if (patch.title !== undefined) day.title = patch.title;
      if (patch.note !== undefined) day.note = patch.note;
      day.updatedAt = at;

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  private buildDays(
    tripId: string,
    durationDays: number,
    startDate: string | null,
    at: string,
    seed: { title: string | null; note: string | null }[],
  ): TripDay[] {
    return Array.from({ length: durationDays }, (_unused, offset) => {
      const preset = seed[offset];
      return {
        id: this.newId('day'),
        tripId,
        dayNumber: offset + 1,
        date: dayDate(startDate, offset + 1),
        title: preset?.title ?? null,
        note: preset?.note ?? null,
        createdAt: at,
        updatedAt: at,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Activities
  // -------------------------------------------------------------------------

  /**
   * Adds an activity to a day — either a catalog place or something the
   * traveller invented. An append cannot lose anybody's edit, so `If-Match` is
   * optional here; it is still honoured when sent.
   */
  addActivity(
    ownerId: string,
    tripId: string,
    input: TripActivityCreateInput,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction(async (data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, false);
      PlannerRepository.requireActive(trip);

      const day = data.tripDays.find(
        (row) => row.tripId === tripId && row.dayNumber === input.dayNumber,
      );
      if (!day) throw notFound(`trip "${tripId}" day`, String(input.dayNumber));

      const place = input.placeSlug ? await this.catalog.getPlace(input.placeSlug) : null;
      if (input.placeSlug && !place) {
        throw invalidReference([
          { path: 'placeSlug', message: `place "${input.placeSlug}" does not exist` },
        ]);
      }
      // Enforced on create only: a place never changes afterwards (the PATCH
      // schema omits `placeSlug`), and template clones and imports copy rows
      // that already exist, so legacy data must stay loadable and editable.
      if (place && place.destinationSlug !== trip.destinationSlug) {
        throw invalidReference([
          {
            path: 'placeSlug',
            message: `place "${place.slug}" belongs to destination "${place.destinationSlug}", not "${trip.destinationSlug}"`,
          },
        ]);
      }

      const siblings = sortedActivities(data, day.id);
      if (siblings.length >= ACTIVITIES_PER_DAY_LIMIT) {
        throw invalidState(
          `day ${input.dayNumber} already holds the maximum of ${ACTIVITIES_PER_DAY_LIMIT} activities`,
        );
      }

      const at = this.timestamp();
      const activity: TripActivity = {
        id: this.newId('act'),
        tripId,
        dayId: day.id,
        order: 0, // replaced by the renumber below
        placeSlug: input.placeSlug,
        title: input.title ?? place?.name.vi ?? '',
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        estimatedCostVnd: input.estimatedCostVnd,
        costScope: input.costScope,
        category: input.category ?? inferCostCategory(place?.category),
        note: input.note,
        createdAt: at,
        updatedAt: at,
      };

      const ordered = [...siblings];
      ordered.splice(insertionIndex(input.toIndex, ordered.length), 0, activity);
      data.tripActivities.push(activity);
      renumber(ordered, at);

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  updateActivity(
    ownerId: string,
    tripId: string,
    activityId: string,
    patch: TripActivityUpdateInput,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      PlannerRepository.requireActive(trip);

      const activity = data.tripActivities.find(
        (row) => row.id === activityId && row.tripId === tripId,
      );
      if (!activity) throw notFound(`trip "${tripId}" activity`, activityId);

      if (patch.title !== undefined) activity.title = patch.title;
      if (patch.startTime !== undefined) activity.startTime = patch.startTime;
      if (patch.durationMinutes !== undefined) activity.durationMinutes = patch.durationMinutes;
      if (patch.estimatedCostVnd !== undefined) activity.estimatedCostVnd = patch.estimatedCostVnd;
      if (patch.costScope !== undefined) activity.costScope = patch.costScope;
      if (patch.category !== undefined) activity.category = patch.category;
      if (patch.note !== undefined) activity.note = patch.note;
      activity.updatedAt = this.timestamp();

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  /**
   * Removes an activity. Any expense that pointed at it keeps its money and
   * its day and simply loses the link — the payment still happened, so
   * deleting a plan row must never delete a record of spending.
   */
  deleteActivity(
    ownerId: string,
    tripId: string,
    activityId: string,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      PlannerRepository.requireActive(trip);

      const activity = data.tripActivities.find(
        (row) => row.id === activityId && row.tripId === tripId,
      );
      if (!activity) throw notFound(`trip "${tripId}" activity`, activityId);

      const at = this.timestamp();
      const { dayId } = activity;
      data.tripActivities = data.tripActivities.filter((row) => row.id !== activityId);
      for (const expense of data.tripExpenses) {
        if (expense.activityId === activityId) {
          expense.activityId = null;
          expense.updatedAt = at;
        }
      }
      renumber(sortedActivities(data, dayId), at);

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  /**
   * Reordering within a day, or moving an activity to another day. Both are
   * structural edits to existing rows, so both require `If-Match`.
   */
  reorder(
    ownerId: string,
    tripId: string,
    input: PlannerReorderInput,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      PlannerRepository.requireActive(trip);

      const at = this.timestamp();
      if (input.op === 'reorder-day') this.reorderDay(data, tripId, input, at);
      else this.moveActivity(data, tripId, input, at);

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  private reorderDay(
    data: PlannerData,
    tripId: string,
    input: Extract<PlannerReorderInput, { op: 'reorder-day' }>,
    at: string,
  ): void {
    const day = data.tripDays.find(
      (row) => row.tripId === tripId && row.dayNumber === input.dayNumber,
    );
    if (!day) throw notFound(`trip "${tripId}" day`, String(input.dayNumber));

    const current = sortedActivities(data, day.id);
    const currentIds = current.map((activity) => activity.id);
    const requested = input.activityIds;

    if (new Set(requested).size !== requested.length) {
      throw invalidState('activityIds contains a duplicate');
    }
    const samePermutation =
      requested.length === currentIds.length &&
      requested.every((id) => currentIds.includes(id));
    if (!samePermutation) {
      throw invalidState(
        `activityIds must be a permutation of day ${input.dayNumber}'s activities (${currentIds.join(', ') || 'none'})`,
      );
    }

    const byId = new Map(current.map((activity) => [activity.id, activity]));
    requested.forEach((id, order) => {
      const activity = byId.get(id);
      if (!activity) throw invalidState(`unknown activity "${id}"`);
      activity.order = order;
      activity.updatedAt = at;
    });
  }

  private moveActivity(
    data: PlannerData,
    tripId: string,
    input: Extract<PlannerReorderInput, { op: 'move-activity' }>,
    at: string,
  ): void {
    const activity = data.tripActivities.find(
      (row) => row.id === input.activityId && row.tripId === tripId,
    );
    if (!activity) throw notFound(`trip "${tripId}" activity`, input.activityId);

    const target = data.tripDays.find(
      (row) => row.tripId === tripId && row.dayNumber === input.toDayNumber,
    );
    if (!target) throw notFound(`trip "${tripId}" day`, String(input.toDayNumber));

    const sourceDayId = activity.dayId;
    if (sourceDayId === target.id) {
      const ordered = sortedActivities(data, target.id).filter(
        (row) => row.id !== activity.id,
      );
      ordered.splice(insertionIndex(input.toIndex, ordered.length), 0, activity);
      renumber(ordered, at);
      return;
    }

    const destination = sortedActivities(data, target.id);
    if (destination.length >= ACTIVITIES_PER_DAY_LIMIT) {
      throw invalidState(
        `day ${input.toDayNumber} already holds the maximum of ${ACTIVITIES_PER_DAY_LIMIT} activities`,
      );
    }

    activity.dayId = target.id;
    activity.updatedAt = at;
    destination.splice(insertionIndex(input.toIndex, destination.length), 0, activity);
    renumber(destination, at);
    renumber(sortedActivities(data, sourceDayId), at);

    // An expense attached to this activity follows it, so day totals stay
    // truthful after a move.
    for (const expense of data.tripExpenses) {
      if (expense.activityId === activity.id && expense.dayId !== target.id) {
        expense.dayId = target.id;
        expense.updatedAt = at;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Expenses
  // -------------------------------------------------------------------------

  /** Records money actually paid. Appends do not require `If-Match`. */
  addExpense(
    ownerId: string,
    tripId: string,
    input: TripExpenseCreateInput,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, false);
      PlannerRepository.requireActive(trip);

      const at = this.timestamp();
      const expense: TripExpense = {
        id: this.newId('exp'),
        tripId,
        dayId: this.resolveExpenseDay(data, tripId, input.activityId, input.dayNumber),
        activityId: input.activityId,
        label: input.label,
        category: input.category,
        amountVnd: input.amountVnd,
        costScope: input.costScope,
        paidOn: input.paidOn,
        note: input.note,
        createdAt: at,
        updatedAt: at,
      };
      data.tripExpenses.push(expense);

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  updateExpense(
    ownerId: string,
    tripId: string,
    expenseId: string,
    patch: TripExpenseUpdateInput,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      PlannerRepository.requireActive(trip);

      const expense = data.tripExpenses.find(
        (row) => row.id === expenseId && row.tripId === tripId,
      );
      if (!expense) throw notFound(`trip "${tripId}" expense`, expenseId);

      if (patch.label !== undefined) expense.label = patch.label;
      if (patch.category !== undefined) expense.category = patch.category;
      if (patch.amountVnd !== undefined) expense.amountVnd = patch.amountVnd;
      if (patch.costScope !== undefined) expense.costScope = patch.costScope;
      if (patch.paidOn !== undefined) expense.paidOn = patch.paidOn;
      if (patch.note !== undefined) expense.note = patch.note;
      if (patch.activityId !== undefined || patch.dayNumber !== undefined) {
        const activityId =
          patch.activityId !== undefined ? patch.activityId : expense.activityId;
        expense.activityId = activityId;
        expense.dayId = this.resolveExpenseDay(data, tripId, activityId, patch.dayNumber);
      }
      expense.updatedAt = this.timestamp();

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  deleteExpense(
    ownerId: string,
    tripId: string,
    expenseId: string,
    expectedVersion: number | null,
  ): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      PlannerRepository.requireActive(trip);

      const exists = data.tripExpenses.some(
        (row) => row.id === expenseId && row.tripId === tripId,
      );
      if (!exists) throw notFound(`trip "${tripId}" expense`, expenseId);
      data.tripExpenses = data.tripExpenses.filter((row) => row.id !== expenseId);

      return buildTripView(data, this.touch(data, index, trip));
    });
  }

  /**
   * Where an expense belongs on the calendar. An expense linked to an activity
   * always takes that activity's day, so the two can never disagree; a
   * contradicting `dayNumber` is refused rather than quietly overridden.
   */
  private resolveExpenseDay(
    data: PlannerData,
    tripId: string,
    activityId: string | null,
    dayNumber: number | null | undefined,
  ): string | null {
    const day =
      dayNumber === null || dayNumber === undefined
        ? null
        : data.tripDays.find((row) => row.tripId === tripId && row.dayNumber === dayNumber);
    if (dayNumber !== null && dayNumber !== undefined && !day) {
      throw invalidReference([
        { path: 'dayNumber', message: `trip "${tripId}" has no day ${dayNumber}` },
      ]);
    }

    if (activityId === null) return day ? day.id : null;

    const activity = data.tripActivities.find(
      (row) => row.id === activityId && row.tripId === tripId,
    );
    if (!activity) {
      throw invalidReference([
        {
          path: 'activityId',
          message: `trip "${tripId}" has no activity "${activityId}"`,
        },
      ]);
    }
    if (day && day.id !== activity.dayId) {
      throw invalidReference([
        {
          path: 'dayNumber',
          message: `activity "${activityId}" is not on day ${dayNumber} — leave dayNumber out and it follows the activity`,
        },
      ]);
    }
    return activity.dayId;
  }

  /** Stamps the aggregate as changed. Called by every mutation, exactly once. */
  private touch(data: PlannerData, index: number, trip: Trip, patch: Partial<Trip> = {}): Trip {
    const next: Trip = {
      ...trip,
      ...patch,
      version: trip.version + 1,
      updatedAt: this.timestamp(),
    };
    data.trips[index] = next;
    return next;
  }

  // -------------------------------------------------------------------------
  // Integrity sweep — catches a hand-edited JSON file
  // -------------------------------------------------------------------------

  /**
   * Referential and structural sweep over the whole Planner document.
   *
   * The JSON store enforces no foreign keys and no unique constraints, so every
   * invariant this repository maintains on write can still be broken by editing
   * `planner.json` by hand, or by a bug in an earlier version of this code. The
   * content system answers that with `validateIntegrity()`; this is the Planner's
   * equivalent, and it checks the things the write paths guarantee: owners exist,
   * days are 1..n and dated from the trip, activity order has no gaps, an
   * expense agrees with the activity it is attached to, and nothing is orphaned.
   *
   * **It reports identifiers only — never trip content.** No title, label, note
   * or amount appears in an issue, because this endpoint is reached with the
   * operator's `ADMIN_API_TOKEN`, which deliberately cannot read a trip
   * (ADR 0002 §3). An operator learns that trip `trip_7` has a numbering gap,
   * not where its owner is going or what they spent.
   */
  async validateIntegrity(): Promise<IntegrityIssue[]> {
    const data = await this.snapshot();
    const issues: IntegrityIssue[] = [];
    const report = (entity: string, id: string, issue: string) =>
      issues.push({ entity, id, issue });

    // --- indexes, built once -------------------------------------------------
    const userIds = new Set(data.users.map((user) => user.id));
    const tripById = new Map(data.trips.map((trip) => [trip.id, trip]));
    const dayById = new Map(data.tripDays.map((day) => [day.id, day]));
    const activityById = new Map(
      data.tripActivities.map((activity) => [activity.id, activity]),
    );

    reportDuplicates('planner session', data.sessions, (row) => row.id, report);
    reportDuplicates('planner user', data.users, (user) => user.id, report);
    reportDuplicates('planner user', data.users, (user) => user.handle, report, 'handle');
    reportDuplicates('trip', data.trips, (trip) => trip.id, report);
    reportDuplicates('trip day', data.tripDays, (day) => day.id, report);
    reportDuplicates('trip activity', data.tripActivities, (a) => a.id, report);
    reportDuplicates('trip expense', data.tripExpenses, (e) => e.id, report);

    // --- users ---------------------------------------------------------------
    // Email and Google ids are personal data or credential identifiers, so a
    // clash is reported against the *user ids* involved, never by value.
    const usersByEmail = new Map<string, string[]>();
    const usersBySub = new Map<string, string[]>();
    for (const user of data.users) {
      if (!/^[0-9a-f]{64}$/.test(user.tokenHash)) {
        // Reported as a shape problem; the value itself is never echoed.
        report('planner user', user.id, 'tokenHash is not a 64-character SHA-256 digest');
      }
      if (user.passwordHash && !parsePasswordHash(user.passwordHash)) {
        report('planner user', user.id, 'passwordHash is not a valid scrypt hash');
      }
      if (user.passwordHash && !user.email) {
        report('planner user', user.id, 'has a password but no email to sign in with');
      }
      if (user.email) usersByEmail.set(user.email, [...(usersByEmail.get(user.email) ?? []), user.id]);
      if (user.googleSub) {
        usersBySub.set(user.googleSub, [...(usersBySub.get(user.googleSub) ?? []), user.id]);
      }
    }
    for (const ids of usersByEmail.values()) {
      if (ids.length > 1) for (const id of ids) report('planner user', id, 'shares its email with another user');
    }
    for (const ids of usersBySub.values()) {
      if (ids.length > 1) for (const id of ids) report('planner user', id, 'shares its Google link with another user');
    }

    // --- Google sign-in attempts --------------------------------------------
    for (const attempt of data.oauthAttempts) {
      if (Date.parse(attempt.expiresAt) <= sweepNowMs(this.now())) {
        report('oauth attempt', attempt.id, 'has expired and has not been swept');
      }
    }

    // --- sessions ------------------------------------------------------------
    const sweepNow = this.now();
    for (const session of data.sessions) {
      if (!userIds.has(session.userId)) {
        report('planner session', session.id, `unknown user "${session.userId}"`);
      }
      if (!/^[0-9a-f]{64}$/.test(session.tokenHash)) {
        report(
          'planner session',
          session.id,
          'tokenHash is not a 64-character SHA-256 digest',
        );
      }
      // Expired rows are swept on the next sign-in, so finding one here means
      // nobody has signed in since it lapsed — harmless, but worth seeing.
      if (sessionIsExpired(session, sweepNow, roleOfSessionUser(data, session))) {
        report('planner session', session.id, 'has expired and has not been swept');
      }
    }

    // --- trips ---------------------------------------------------------------
    for (const trip of data.trips) {
      if (!userIds.has(trip.ownerId)) {
        report('trip', trip.id, `unknown owner "${trip.ownerId}"`);
      }
      if (!this.catalog.hasDestination(trip.destinationSlug)) {
        report('trip', trip.id, `unknown destination "${trip.destinationSlug}"`);
      }
      if (trip.version < 1) {
        report('trip', trip.id, `version ${trip.version} is below 1`);
      }

      const expectedEnd =
        trip.startDate === null ? null : addDays(trip.startDate, trip.durationDays - 1);
      if (trip.endDate !== expectedEnd) {
        report(
          'trip',
          trip.id,
          `endDate ${describe(trip.endDate)} disagrees with startDate ${describe(trip.startDate)} + ${trip.durationDays} day(s)`,
        );
      }

      if (trip.status === 'archived' && trip.archivedAt === null) {
        report('trip', trip.id, 'archived with no archivedAt');
      }
      if (trip.status === 'active' && trip.archivedAt !== null) {
        report('trip', trip.id, 'active but still carries an archivedAt');
      }

      const days = data.tripDays
        .filter((day) => day.tripId === trip.id)
        .sort((a, b) => a.dayNumber - b.dayNumber);
      if (days.length !== trip.durationDays) {
        report(
          'trip',
          trip.id,
          `has ${days.length} day row(s) but durationDays is ${trip.durationDays}`,
        );
      }
      const numbering = days.map((day) => day.dayNumber).join(',');
      const expected = Array.from({ length: days.length }, (_unused, i) => i + 1).join(',');
      if (numbering !== expected) {
        report('trip', trip.id, 'days are not numbered 1..n');
      }

      // The clone is independent by design, so a withdrawn or edited template is
      // information rather than corruption — the same line the content system
      // takes on a template whose source story was deleted.
      if (trip.sourceTemplate) {
        const template = await this.catalog.getApprovedTemplate(
          trip.sourceTemplate.templateSlug,
        );
        if (!template) {
          report(
            'trip',
            trip.id,
            `source template "${trip.sourceTemplate.templateSlug}" is no longer approved (snapshot retained)`,
          );
        } else if (template.version > trip.sourceTemplate.templateVersion) {
          report(
            'trip',
            trip.id,
            `source template "${trip.sourceTemplate.templateSlug}" has moved on: cloned at version ${trip.sourceTemplate.templateVersion}, now ${template.version} (snapshot retained)`,
          );
        }
      }
    }

    // --- days ----------------------------------------------------------------
    for (const day of data.tripDays) {
      const trip = tripById.get(day.tripId);
      if (!trip) {
        report('trip day', day.id, `orphan: unknown trip "${day.tripId}"`);
        continue;
      }
      if (day.dayNumber > trip.durationDays) {
        report(
          'trip day',
          day.id,
          `day ${day.dayNumber} is past the trip's ${trip.durationDays} day(s)`,
        );
      }
      const expectedDate =
        trip.startDate === null ? null : addDays(trip.startDate, day.dayNumber - 1);
      if (day.date !== expectedDate) {
        report(
          'trip day',
          day.id,
          `date ${describe(day.date)} disagrees with the trip's calendar (${describe(expectedDate)})`,
        );
      }
    }

    // --- activities ----------------------------------------------------------
    const placeSlugs = new Set(
      data.tripActivities
        .map((activity) => activity.placeSlug)
        .filter((slug): slug is string => slug !== null),
    );
    const missingPlaces = new Set<string>();
    for (const slug of placeSlugs) {
      if ((await this.catalog.getPlace(slug)) === null) missingPlaces.add(slug);
    }

    for (const activity of data.tripActivities) {
      if (!tripById.has(activity.tripId)) {
        report('trip activity', activity.id, `orphan: unknown trip "${activity.tripId}"`);
        continue;
      }
      const day = dayById.get(activity.dayId);
      if (!day) {
        report('trip activity', activity.id, `unknown day "${activity.dayId}"`);
      } else if (day.tripId !== activity.tripId) {
        report(
          'trip activity',
          activity.id,
          `day "${activity.dayId}" belongs to a different trip`,
        );
      }
      if (activity.placeSlug !== null && missingPlaces.has(activity.placeSlug)) {
        report('trip activity', activity.id, `unknown place "${activity.placeSlug}"`);
      }
    }

    // Order is contiguous per day, which is what keeps a reorder a permutation.
    const byDay = new Map<string, TripActivity[]>();
    for (const activity of data.tripActivities) {
      const bucket = byDay.get(activity.dayId);
      if (bucket) bucket.push(activity);
      else byDay.set(activity.dayId, [activity]);
    }
    for (const [dayId, activities] of byDay) {
      const orders = activities.map((activity) => activity.order).sort((a, b) => a - b);
      const wanted = Array.from({ length: activities.length }, (_unused, i) => i);
      if (orders.join(',') !== wanted.join(',')) {
        report('trip day', dayId, 'activity order has a gap or a duplicate');
      }
    }

    // --- expenses ------------------------------------------------------------
    for (const expense of data.tripExpenses) {
      if (!tripById.has(expense.tripId)) {
        report('trip expense', expense.id, `orphan: unknown trip "${expense.tripId}"`);
        continue;
      }

      const day = expense.dayId === null ? null : dayById.get(expense.dayId);
      if (expense.dayId !== null && !day) {
        report('trip expense', expense.id, `unknown day "${expense.dayId}"`);
      } else if (day && day.tripId !== expense.tripId) {
        report('trip expense', expense.id, `day "${expense.dayId}" belongs to a different trip`);
      }

      if (expense.activityId === null) continue;
      const activity = activityById.get(expense.activityId);
      if (!activity) {
        report('trip expense', expense.id, `unknown activity "${expense.activityId}"`);
        continue;
      }
      if (activity.tripId !== expense.tripId) {
        report(
          'trip expense',
          expense.id,
          `activity "${expense.activityId}" belongs to a different trip`,
        );
      }
      // The write path derives dayId from the activity, so a disagreement here
      // means the budget's by-day totals are being computed against the wrong day.
      if (expense.dayId !== activity.dayId) {
        report(
          'trip expense',
          expense.id,
          `dayId ${describe(expense.dayId)} disagrees with its activity's day ${describe(activity.dayId)}`,
        );
      }
    }

    return issues;
  }
}

function toPublicUser(user: PlannerUser): PublicPlannerUser {
  const rest = { ...user } as Partial<PlannerUser>;
  delete rest.tokenHash;
  delete rest.passwordHash;
  delete rest.googleSub;
  return {
    ...(rest as Omit<PublicPlannerUser, 'hasPassword' | 'hasGoogle'>),
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleSub),
    role: userRole(user),
  };
}

const sweepNowMs = (now: Date) => now.getTime();

/** Constant-time comparison of two hex digests. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/**
 * A handle for a self-registered user: the email's local part as a slug
 * (`slugSchema`: lowercase words joined by single hyphens, 3–96 chars), with
 * a short random suffix when taken. Not a credential — just a stable name.
 */
function uniqueHandle(email: string, users: readonly PlannerUser[]): string {
  const local = email.split('@', 1)[0] ?? '';
  let base = local
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  if (base.length < 3) base = `khach-${base}`.replace(/-+$/g, '');
  if (base.length < 3) base = 'khach';
  const taken = new Set(users.map((user) => user.handle));
  if (!taken.has(base)) return base;
  for (;;) {
    const candidate = `${base}-${randomBytes(3).toString('hex')}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function displayNameFor(identity: GoogleIdentity): string {
  const fromName = identity.name?.trim().slice(0, 80) ?? '';
  if (fromName.length >= 2) return fromName;
  const local = (identity.email.split('@', 1)[0] ?? '').slice(0, 80);
  return local.length >= 2 ? local : 'Khách';
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** A trip whose share link may resolve: active, not private, with a token. */
function isShareable(
  trip: Trip,
): trip is Trip & { shareToken: string; visibility: 'unlisted' | 'public' } {
  return trip.status === 'active' && trip.visibility !== 'private' && trip.shareToken !== null;
}

function shareTokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A fresh share token: 32 random bytes, base64url (43 characters). */
function newShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Rows written before ADR 0005 lack the sharing fields. They read as the safe
 * defaults — a draft, private, no token — and nothing is rewritten until the
 * row is next saved.
 */
function withTripDefaults(data: PlannerData): PlannerData {
  for (const trip of data.trips) {
    trip.planningStatus ??= 'draft';
    trip.visibility ??= 'private';
    trip.shareToken ??= null;
    trip.shareTokenCreatedAt ??= null;
    trip.duplicatedFromTripId ??= null;
    if (trip.sourceTemplate) trip.sourceTemplate.story ??= null;
  }
  return data;
}

function endTimeFor(startTime: string | null, durationMinutes: number): string | null {
  if (startTime === null) return null;
  const [h, m] = startTime.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + durationMinutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The public projection. Every output field is named here; nothing is spread
 * from the trip, a day or an activity, so a new stored field stays private
 * until it is added below on purpose.
 */
function buildSharedView(view: TripView, visibility: 'unlisted' | 'public'): SharedTripView {
  const { trip } = view;
  return {
    title: trip.title,
    destinationSlug: trip.destinationSlug,
    startDate: trip.startDate,
    endDate: trip.endDate,
    durationDays: trip.durationDays,
    partySize: trip.partySize,
    travelStyle: trip.travelStyle,
    pace: trip.pace,
    planningStatus: trip.planningStatus,
    visibility,
    days: view.days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      date: day.date,
      activities: day.activities.map((activity) => ({
        order: activity.order,
        title: activity.title,
        placeSlug: activity.placeSlug,
        startTime: activity.startTime,
        endTime: endTimeFor(activity.startTime, activity.durationMinutes),
        category: activity.category,
        note: activity.note,
      })),
    })),
    budget: {
      currency: 'VND',
      targetTotalVnd: trip.budget.targetTotalVnd,
      estimatedTotalVnd: view.budget.estimatedTotalVnd,
      projectedTotalVnd: view.budget.projectedTotalVnd,
      overrunVnd: view.budget.overrunVnd,
      overrunPerPersonVnd: view.budget.perPerson.overrunVnd,
    },
    attribution: trip.sourceTemplate
      ? {
          templateTitle: trip.sourceTemplate.title,
          story: trip.sourceTemplate.story
            ? { slug: trip.sourceTemplate.story.slug, title: trip.sourceTemplate.story.title }
            : null,
          clonedAt: trip.sourceTemplate.clonedAt,
        }
      : null,
  };
}

/** What a creation path produces before the trip row itself is assembled. */
interface TripDraft {
  title: string;
  destinationSlug: string;
  durationDays: number;
  travelStyle: Trip['travelStyle'];
  pace: Trip['pace'];
  sourceTemplate: Trip['sourceTemplate'];
  days: TripDay[];
  activities: TripActivity[];
}

/**
 * Assembles the response view. The budget is computed here, on every read, and
 * is never stored: a derived total that can be saved is a derived total that
 * can be wrong (the content system takes the same line with `estimatedTotalVnd`).
 */
function buildTripView(data: PlannerData, trip: Trip): TripView {
  const days = data.tripDays
    .filter((day) => day.tripId === trip.id)
    .sort((a, b) => a.dayNumber - b.dayNumber);
  const activities = data.tripActivities.filter(
    (activity) => activity.tripId === trip.id,
  );
  const expenses = data.tripExpenses
    .filter((expense) => expense.tripId === trip.id)
    .sort(
      (a, b) =>
        (a.paidOn ?? '').localeCompare(b.paidOn ?? '') || a.createdAt.localeCompare(b.createdAt),
    );

  const byDay = new Map<string, TripActivity[]>();
  for (const activity of activities) {
    const bucket = byDay.get(activity.dayId);
    if (bucket) bucket.push(activity);
    else byDay.set(activity.dayId, [activity]);
  }

  return {
    trip,
    days: days.map((day) => ({
      ...day,
      activities: (byDay.get(day.id) ?? []).sort((a, b) => a.order - b.order),
    })),
    expenses,
    budget: computeTripBudget(trip, days, activities, expenses),
  };
}

/**
 * The day's activities, in order, as **live references** into the store — the
 * callers above renumber them in place, which is what keeps `order` contiguous.
 */
function sortedActivities(data: PlannerData, dayId: string): TripActivity[] {
  return data.tripActivities
    .filter((activity) => activity.dayId === dayId)
    .sort((a, b) => a.order - b.order);
}

/** Rewrites `order` to 0..n-1 over the given sequence. */
function renumber(activities: TripActivity[], at: string): void {
  activities.forEach((activity, order) => {
    if (activity.order !== order) {
      activity.order = order;
      activity.updatedAt = at;
    }
  });
}

/** An omitted or out-of-range index appends; a valid one inserts in place. */
function insertionIndex(index: number | undefined, length: number): number {
  if (index === undefined) return length;
  return Math.max(0, Math.min(index, length));
}

/** Day N of a trip starting on `startDate`; null while the dates are open. */
function dayDate(startDate: string | null, dayNumber: number): string | null {
  return startDate === null ? null : addDays(startDate, dayNumber - 1);
}

/** The session principal behind an admin call; absent for the service token. */
export interface AdminActor {
  userId: string;
}

function selfAdminAction(what: string): ContentError {
  return new ContentError(
    'invalid_state',
    `an admin session cannot ${what}; use the account password page or ask another admin`,
  );
}

/**
 * Re-checks, inside the transaction, that the acting session user still exists
 * and is still an admin: the request-time check and the write are not atomic.
 */
function assertActorStillAdmin(data: PlannerData, actor: AdminActor | undefined): void {
  if (!actor) return;
  const user = data.users.find((candidate) => candidate.id === actor.userId);
  if (!user || userRole(user) !== 'admin') {
    throw forbidden('the acting account is no longer an admin');
  }
}

function assertAnotherAdminExists(data: PlannerData, userId: string, verb: string): void {
  const others = data.users.filter(
    (candidate) => candidate.id !== userId && userRole(candidate) === 'admin',
  ).length;
  if (others === 0) {
    throw new ContentError(
      'invalid_state',
      `cannot ${verb} the last admin: at least one admin must remain`,
    );
  }
}

function endDateFor(startDate: string | null, durationDays: number): string | null {
  return startDate === null ? null : addDays(startDate, durationDays - 1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Expiry on two axes (ADR 0004 §5): an absolute end of life fixed at sign-in,
 * and an idle window since the session was last used. Either one ends it.
 */
function sessionIsExpired(session: PlannerSession, now: Date, role: Role = 'member'): boolean {
  const nowMs = now.getTime();
  if (role === 'admin') {
    // Admin lifetime (ADR 0010 §4): absolute counted from sign-in, never longer
    // than the stored expiry; idle window much shorter.
    const absoluteEnd = Math.min(
      Date.parse(session.expiresAt),
      Date.parse(session.createdAt) + ADMIN_SESSION_ABSOLUTE_HOURS * HOUR_MS,
    );
    if (nowMs >= absoluteEnd) return true;
    return nowMs >= Date.parse(session.lastSeenAt) + ADMIN_SESSION_IDLE_HOURS * HOUR_MS;
  }
  if (nowMs >= Date.parse(session.expiresAt)) return true;
  return nowMs >= Date.parse(session.lastSeenAt) + SESSION_IDLE_DAYS * DAY_MS;
}

const HOUR_MS = 60 * 60 * 1000;

/** The current role of the user a session belongs to; `member` if the user is gone. */
function roleOfSessionUser(data: PlannerData, session: PlannerSession): Role {
  const user = data.users.find((candidate) => candidate.id === session.userId);
  return user ? userRole(user) : 'member';
}

/** Throttles the `lastSeenAt` write so a read is not usually a write. */
function sessionNeedsTouch(session: PlannerSession, now: Date, role: Role = 'member'): boolean {
  const minutes =
    role === 'admin' ? ADMIN_SESSION_TOUCH_INTERVAL_MINUTES : SESSION_TOUCH_INTERVAL_MINUTES;
  return now.getTime() - Date.parse(session.lastSeenAt) >= minutes * 60_000;
}

/** Renders a nullable id or date for an issue message, without quoting noise. */
function describe(value: string | null): string {
  return value === null ? 'null' : `"${value}"`;
}

/**
 * Reports every value that appears more than once under `key`. The JSON store
 * has no unique constraint, so a duplicated id is a real possibility and a
 * nasty one — two rows with one id make every lookup order-dependent.
 */
function reportDuplicates<T>(
  entity: string,
  rows: readonly T[],
  key: (row: T) => string,
  report: (entity: string, id: string, issue: string) => void,
  label = 'id',
): void {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const row of rows) {
    const value = key(row);
    if (seen.has(value)) duplicated.add(value);
    seen.add(value);
  }
  for (const value of duplicated) {
    report(entity, value, `${label} "${value}" appears on more than one row`);
  }
}

/** Calendar arithmetic in UTC, so a server timezone cannot shift a trip a day. */
function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * A catalog place implies what kind of money it costs. Anything without a
 * place — or a place whose category says nothing about spending — is `other`,
 * which the traveller can always override.
 */
function inferCostCategory(category: PlaceCategory | undefined): CostCategory {
  switch (category) {
    case 'cafe':
    case 'restaurant':
    case 'street-food':
      return 'food';
    case 'stay':
      return 'stay';
    case 'transport':
      return 'transport';
    case 'market':
      return 'shopping';
    case 'museum':
    case 'viewpoint':
    case 'nature':
    case 'activity':
      return 'tickets';
    default:
      return 'other';
  }
}
