import { randomUUID } from 'node:crypto';
import {
  invalidReference,
  invalidState,
  notFound,
  preconditionRequired,
  slugConflict,
  versionConflict,
} from '@/server/content/errors';
import type { CostCategory, PlaceCategory } from '@/server/content/schemas';
import { authorizePlannerUser, hashAccessToken, issueAccessToken, type PlannerIdentity } from './auth';
import { computeTripBudget, type TripBudgetSummary } from './budget';
import type { PlannerCatalog } from './catalog';
import type { PlannerData, PlannerStore } from './store';
import {
  ACTIVITIES_PER_DAY_LIMIT,
  type PlannerReorderInput,
  type PlannerUser,
  type PlannerUserCreateInput,
  type PublicPlannerUser,
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

export class PlannerRepository {
  private readonly store: PlannerStore;
  private readonly catalog: PlannerCatalog;
  private readonly now: () => Date;
  private readonly newId: (prefix: string) => string;
  /** Serialises read-modify-write pairs so two mutations cannot interleave. */
  private queue: Promise<unknown> = Promise.resolve();

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
      const data = await this.store.read();
      const result = await mutate(data);
      await this.store.write(data);
      return result;
    };
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private snapshot(): Promise<PlannerData> {
    return this.store.read();
  }

  // -------------------------------------------------------------------------
  // Identity and users
  // -------------------------------------------------------------------------

  /** Resolves the bearer token on a request to a planner user, or throws 401. */
  async identify(request: Request): Promise<PlannerIdentity> {
    const data = await this.snapshot();
    return authorizePlannerUser(request, data.users);
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
      });
    });
  }

  /** Brings an archived trip back, untouched. */
  restoreTrip(ownerId: string, tripId: string, expectedVersion: number | null): Promise<TripView> {
    return this.transaction((data) => {
      const { trip, index } = PlannerRepository.requireOwnedTrip(data, ownerId, tripId);
      PlannerRepository.requireVersion(trip, expectedVersion, true);
      if (trip.status !== 'archived') {
        throw invalidState(`trip "${tripId}" is not archived`);
      }
      const next = this.touch(data, index, trip, { status: 'active', archivedAt: null });
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
}

function toPublicUser(user: PlannerUser): PublicPlannerUser {
  const rest = { ...user } as Partial<PlannerUser>;
  delete rest.tokenHash;
  return rest as PublicPlannerUser;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

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
