import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  ContentError,
  invalidReference,
  invalidState,
  notFound,
  preconditionRequired,
  slugConflict,
  versionConflict,
} from '@/server/content/errors';
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
import type { PlannerCatalog } from './catalog';
import type { PlannerData, PlannerStore } from './store';
import {
  ACTIVITIES_PER_DAY_LIMIT,
  SESSION_ABSOLUTE_DAYS,
  SESSION_IDLE_DAYS,
  SESSION_TOUCH_INTERVAL_MINUTES,
  type PlannerReorderInput,
  type PlannerSession,
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

export class PlannerRepository {
  private readonly store: PlannerStore;
  private readonly catalog: PlannerCatalog;
  private readonly now: () => Date;
  private readonly newId: (prefix: string) => string;
  /** Serialises read-modify-write pairs so two mutations cannot interleave. */
  private queue: Promise<unknown> = Promise.resolve();
  /**
   * SHA-256 (hex) of every live share token → trip id, so resolving a share
   * link is one map lookup instead of re-hashing every trip on every
   * unauthenticated request (and a wrong guess never reads the store at all).
   * Dropped on every write; `shareIndexGeneration` stops a read that raced a
   * write from caching an index built from the older snapshot.
   */
  private shareIndex: Map<string, string> | null = null;
  private shareIndexGeneration = 0;

  constructor(options: PlannerRepositoryOptions) {
    this.store = options.store;
    this.catalog = options.catalog;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? ((prefix) => `${prefix}_${randomUUID().slice(0, 8)}`);
  }

  // -------------------------------------------------------------------------
  // Transaction plumbing
  // -------------------------------------------------------------------------

  /**
   * Read, mutate, write — with every pair serialised behind one promise chain.
   * A throw inside `mutate` abandons the whole change: nothing is written, so a
   * failed validation can never leave half an activity behind.
   */
  private transaction<T>(mutate: (data: PlannerData) => Promise<T> | T): Promise<T> {
    const run = async (): Promise<T> => {
      const data = withTripDefaults(await this.store.read());
      const result = await mutate(data);
      await this.store.write(data);
      this.shareIndex = null;
      this.shareIndexGeneration += 1;
      return result;
    };
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
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
        if (sessionIsExpired(session, now)) {
          await this.dropSession(session.id);
          throw sessionExpired();
        }

        const user = data.users.find((candidate) => candidate.id === session.userId);
        if (user) {
          if (sessionNeedsTouch(session, now)) await this.touchSession(session.id, now);
          return { userId: user.id, handle: user.handle, source: 'cookie' };
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
      };

      data.sessions = data.sessions.filter(
        (candidate) => !sessionIsExpired(candidate, now),
      );
      data.sessions.push(session);

      return { user: toPublicUser(user), token, expiresAt: session.expiresAt };
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

  /** Provisions a traveller and issues their one and only access token. */
  createUser(input: PlannerUserCreateInput): Promise<IssuedPlannerUser> {
    return this.transaction((data) => {
      if (data.users.some((user) => user.handle === input.handle)) {
        throw slugConflict('planner user', input.handle);
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
      };
      data.users.push(user);
      return { user: toPublicUser(user), accessToken };
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
      if (index < 0) throw notFound('planner user', userId);

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
        story: this.catalog.getLinkedStory(template.slug),
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
    if (this.shareIndex) return this.shareIndex;

    const generation = this.shareIndexGeneration;
    const data = await this.snapshot();
    const index = new Map<string, string>();
    for (const trip of data.trips) {
      if (isShareable(trip)) index.set(shareTokenDigest(trip.shareToken), trip.id);
    }
    // A write landed while we were reading: use this index once, don't keep it.
    if (generation === this.shareIndexGeneration) this.shareIndex = index;
    return index;
  }

  /** Session details for `GET /api/planner/session`. Never returns a credential. */
  async describeSession(
    request: Request,
    userId: string,
  ): Promise<{ user: PublicPlannerUser; expiresAt: string | null }> {
    const data = await this.snapshot();
    const user = data.users.find((candidate) => candidate.id === userId);
    if (!user) throw new ContentError('unauthorized', 'this credential is not valid');

    const presented = sessionTokenFromRequest(request);
    const session = presented ? findSessionByToken(data.sessions, presented) : null;
    return {
      user: toPublicUser(user),
      expiresAt: session && session.userId === userId ? session.expiresAt : null,
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
    for (const user of data.users) {
      if (!/^[0-9a-f]{64}$/.test(user.tokenHash)) {
        // Reported as a shape problem; the value itself is never echoed.
        report('planner user', user.id, 'tokenHash is not a 64-character SHA-256 digest');
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
      if (sessionIsExpired(session, sweepNow)) {
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
  return rest as PublicPlannerUser;
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

function endDateFor(startDate: string | null, durationDays: number): string | null {
  return startDate === null ? null : addDays(startDate, durationDays - 1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Expiry on two axes (ADR 0004 §5): an absolute end of life fixed at sign-in,
 * and an idle window since the session was last used. Either one ends it.
 */
function sessionIsExpired(session: PlannerSession, now: Date): boolean {
  const nowMs = now.getTime();
  if (nowMs >= Date.parse(session.expiresAt)) return true;
  return nowMs >= Date.parse(session.lastSeenAt) + SESSION_IDLE_DAYS * DAY_MS;
}

/** Throttles the `lastSeenAt` write so a read is not usually a write. */
function sessionNeedsTouch(session: PlannerSession, now: Date): boolean {
  return (
    now.getTime() - Date.parse(session.lastSeenAt) >=
    SESSION_TOUCH_INTERVAL_MINUTES * 60_000
  );
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
