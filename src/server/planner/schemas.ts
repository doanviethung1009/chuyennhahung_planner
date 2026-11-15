import { z } from 'zod';
import { roleSchema } from '@/server/identity/permissions';
import {
  costCategorySchema,
  isoDateSchema,
  localizedTextSchema,
  paceSchema,
  slugSchema,
  timestampSchema,
  travelStyleSchema,
  vndSchema,
} from '@/server/content/schemas';

/**
 * Data contract for the Planner core. Every type is `z.infer`-ed from the
 * schema that validates it, exactly as in the Travel Content System, so a
 * validator and its model cannot drift apart. See `docs/adr/0002-planner-core.md`.
 *
 * Two conventions are inherited deliberately rather than reinvented:
 * `vndSchema` (integer đồng) and `costCategorySchema` — a trip's spending and a
 * story's spending are the same vocabulary, and a Planner-only copy would drift.
 *
 * One convention is deliberately **not** inherited: a trip's own text is a
 * plain string, not `localizedText`. CLAUDE.md rule 1 governs *product* copy —
 * strings we ship. A trip title is something a traveller typed, in their own
 * language; demanding a Vietnamese and an English version of it would be
 * nonsense. Every Planner string the *app* renders still lives in both message
 * catalogues (ADR 0002 §2).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Server-assigned, prefixed ids (`trip_`, `day_`, `act_`, `exp_`, `usr_`). */
export const plannerIdSchema = z.string().trim().min(1).max(64);

const titleSchema = z.string().trim().min(2).max(160);
const labelSchema = z.string().trim().min(2).max(160);
const noteSchema = z.string().trim().max(2_000).nullable().default(null);

export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM, 24-hour');

/** A trip is at most a month in this phase, and a day numbering is 1-based. */
export const DAY_LIMIT = 30;
export const ACTIVITIES_PER_DAY_LIMIT = 40;

export const dayNumberSchema = z.number().int().min(1).max(DAY_LIMIT);
export const partySizeSchema = z.number().int().min(1).max(50);

/**
 * Whether an amount covers the whole party or one traveller. This is the single
 * most error-prone field in trip budgeting — "500k for dinner" means something
 * different for two people than per head — so it is explicit on every money
 * row and never inferred.
 */
export const costScopeSchema = z.enum(['group', 'per_person']);

export const tripStatusSchema = z.enum(['active', 'archived']);

/** Where the traveller is in planning — independent of `status` (archive). */
export const planningStatusSchema = z.enum(['draft', 'planned', 'completed']);

/** Who may read a trip. Changed only through the share endpoints (ADR 0005). */
export const visibilitySchema = z.enum(['private', 'unlisted', 'public']);

/** How the author appears on the community gallery (ADR 0014). */
export const authorDisplaySchema = z.enum(['name', 'anonymous']);
export const listingStatusSchema = z.enum(['pending', 'approved', 'rejected']);

/**
 * A trip's place on the home page and gallery (ADR 0014). Absent / `null` means
 * "not listed". Separate from `visibility`: `public` is an indexable link,
 * `listing.status === 'approved'` is what puts it in front of visitors.
 */
export const tripListingSchema = z.object({
  status: listingStatusSchema,
  authorDisplay: authorDisplaySchema,
  requestedAt: timestampSchema,
  decidedAt: timestampSchema.nullable(),
  /** The staff user id, or `service`. Never shown publicly. */
  decidedBy: z.string().max(80).nullable(),
  rejectReason: z.string().trim().max(500).nullable(),
});

/** `PUT /listing` body. Strict: status and decision fields are never accepted. */
export const listingRequestSchema = z.object({ authorDisplay: authorDisplaySchema }).strict();

/** `PATCH /api/admin/community/trips/[id]` body. */
export const listingDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'remove']),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict()
  .refine((value) => value.decision === 'approve' || value.reason !== undefined, {
    message: 'a reason is required to reject or remove',
    path: ['reason'],
  });

/** 32 random bytes, base64url: 43 characters. Checked before any lookup. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** `PUT /share` body. Strict: `shareToken` and friends are never accepted. */
export const shareSettingsSchema = z.object({ visibility: visibilitySchema }).strict();

/** `POST /duplicate` body. Strict, so visibility/token cannot be smuggled in. */
export const tripDuplicateSchema = z
  .object({ title: z.string().trim().min(1).max(120).optional() })
  .strict();

export const budgetInputSchema = z.object({
  targetTotalVnd: vndSchema,
  currency: z.literal('VND').default('VND'),
});

export const budgetSchema = z.object({
  targetTotalVnd: vndSchema,
  currency: z.literal('VND'),
});

// ---------------------------------------------------------------------------
// Planner users — the owner of a trip
// ---------------------------------------------------------------------------

/**
 * Email as stored and compared: trimmed and lower-cased, nothing else (dots in
 * a Gmail address are kept — ADR 0007, data model).
 */
export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform((value) => value.toLowerCase());

/** NIST SP 800-63B: length only, any characters, no composition rules. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/** Strict, like the role PATCH: it can grant a role, so an unknown key is a 422. */
export const plannerUserCreateSchema = z.object({
  handle: slugSchema,
  displayName: z.string().trim().min(2).max(80),
  /** When given, a temporary password is issued with the user (ADR 0007). */
  email: emailSchema.optional(),
  /** Defaults to `member` when absent (ADR 0006). */
  role: roleSchema.optional(),
}).strict();

/** Strict: this route grants privilege, so an unknown key is a 422. */
export const plannerUserRoleUpdateSchema = z.object({ role: roleSchema }).strict();

/**
 * Stored shape. `tokenHash` is a SHA-256 digest of the access token — the token
 * itself is shown once, at issue, and is never stored or returned again.
 */
export const plannerUserSchema = z.object({
  id: plannerIdSchema,
  handle: slugSchema,
  displayName: z.string().trim().min(2).max(80),
  tokenHash: z.string().length(64),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  // --- ADR 0007. All optional: a file written before it loads unchanged. ---
  /** Lower-cased; unique across users. */
  email: z.string().max(254).nullable().optional(),
  /** `scrypt$N$r$p$salt$hash`. Absent or null: password sign-in is off. */
  passwordHash: z.string().nullable().optional(),
  /** Set by an operator-issued temporary password; cleared by a change. */
  mustChangePassword: z.boolean().optional(),
  /** Google's stable subject id; unique across users. */
  googleSub: z.string().max(255).nullable().optional(),
  /** Absent reads as `operator`. */
  createdVia: z.enum(['operator', 'google']).optional(),
  // --- ADR 0006. Optional: absent reads as `member` via `userRole`. ---
  role: roleSchema.optional(),
});

/**
 * What the API is allowed to return: no credential and no credential
 * identifier. `hasPassword` / `hasGoogle` say *whether* one exists.
 */
export const publicPlannerUserSchema = plannerUserSchema
  .omit({ tokenHash: true, passwordHash: true, googleSub: true })
  .extend({ hasPassword: z.boolean(), hasGoogle: z.boolean(), role: roleSchema });

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

const tripCoreInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  /** Reuses `Destination.slug` — never a free-text region. */
  destinationSlug: slugSchema,
  /**
   * Optional: a trip can be planned before its dates are fixed. When present,
   * every day is dated from it, so "day 2" always resolves to a real date.
   */
  startDate: isoDateSchema.nullable().default(null),
  /** "3 ngày 2 đêm" is `durationDays: 3` — nights are derived, never stored. */
  durationDays: dayNumberSchema,
  partySize: partySizeSchema,
  travelStyle: travelStyleSchema.nullable().default(null),
  pace: paceSchema.nullable().default(null),
  budget: budgetInputSchema,
  note: noteSchema,
});

/** A trip planned from scratch. Days are generated from `durationDays`. */
export const tripBlankCreateSchema = tripCoreInputSchema
  .extend({ source: z.literal('blank') })
  .strict();

/**
 * A trip cloned from an approved (public) template. Shape, duration and
 * destination come from the template; the traveller supplies only what is
 * theirs — when they are going, how many of them, and what they want to spend.
 */
export const tripFromTemplateCreateSchema = z
  .object({
  source: z.literal('template'),
  templateSlug: slugSchema,
  /** Defaults to the template's Vietnamese title. */
  title: z.string().trim().min(3).max(120).optional(),
  startDate: isoDateSchema.nullable().default(null),
  partySize: partySizeSchema,
  budget: budgetInputSchema,
  /** Override the template's own style/pace when the traveller differs. */
  travelStyle: travelStyleSchema.nullable().optional(),
  pace: paceSchema.nullable().optional(),
  note: noteSchema,
  })
  .strict();

export const tripCreateSchema = z.discriminatedUnion('source', [
  tripBlankCreateSchema,
  tripFromTemplateCreateSchema,
]);

/**
 * PATCH semantics. `destinationSlug` is immutable: activities hang off places
 * in that destination, so moving a trip elsewhere is a new trip, not an edit.
 */
/**
 * PATCH schemas are built from the create schemas, but a create schema's
 * `.default(...)` must not survive into a PATCH: Zod 4 applies a default even
 * inside `.optional()`/`.partial()`, so `{ planningStatus: 'planned' }` would
 * parse as `{ planningStatus, startDate: null, pace: null, note: null, … }` and
 * silently wipe every field the client did not send. Strip the defaults first,
 * then make every field optional.
 */
type WithoutDefaults<S extends z.ZodRawShape> = {
  [K in keyof S]: S[K] extends z.ZodDefault<infer Inner> ? Inner : S[K];
};

function withoutDefaults<S extends z.ZodRawShape>(shape: S): WithoutDefaults<S> {
  return Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  ) as WithoutDefaults<S>;
}

export const tripUpdateSchema = z
  .object(
    withoutDefaults(
      tripCoreInputSchema
        .omit({ destinationSlug: true })
        .extend({ planningStatus: planningStatusSchema }).shape,
    ),
  )
  .partial()
  .strict();

/**
 * The frozen record of the template a trip was cloned from. Provenance only —
 * the clone owns independent rows from the moment it is created, and nothing
 * here is ever read back to re-derive the trip (ADR 0002 §4).
 */
export const tripTemplateSnapshotSchema = z.object({
  templateSlug: slugSchema,
  title: localizedTextSchema,
  /** The template's `version` at clone time, so staleness is visible. */
  templateVersion: z.number().int().min(1),
  durationDays: z.number().int().min(1),
  estimatedTotalVnd: vndSchema,
  clonedAt: timestampSchema,
  /**
   * The story this template is linked to, derived server-side at clone time —
   * never accepted from a client. Absent on older rows, which read as null.
   */
  story: z
    .object({ slug: slugSchema, title: localizedTextSchema })
    .nullable()
    .default(null),
});

export const tripSchema = z.object({
  id: plannerIdSchema,
  /** → `plannerUsers.id`. Every read and write is scoped by this. */
  ownerId: plannerIdSchema,
  title: z.string().trim().min(3).max(120),
  destinationSlug: slugSchema,
  startDate: isoDateSchema.nullable(),
  /** Derived from `startDate` + `durationDays`; null when dates are open. */
  endDate: isoDateSchema.nullable(),
  durationDays: dayNumberSchema,
  partySize: partySizeSchema,
  travelStyle: travelStyleSchema.nullable(),
  pace: paceSchema.nullable(),
  budget: budgetSchema,
  note: z.string().max(2_000).nullable(),
  status: tripStatusSchema,
  archivedAt: timestampSchema.nullable(),
  sourceTemplate: tripTemplateSnapshotSchema.nullable(),
  /** Absent on older rows, which read as `draft`. */
  planningStatus: planningStatusSchema.default('draft'),
  /** Absent on older rows, which read as `private`. */
  visibility: visibilitySchema.default('private'),
  /** Bearer secret for the read-only link. Never leaves the owner's API. */
  shareToken: z.string().regex(SHARE_TOKEN_PATTERN).nullable().default(null),
  shareTokenCreatedAt: timestampSchema.nullable().default(null),
  /** ADR 0014. `null` = not listed. Absent on older rows. */
  listing: tripListingSchema.nullable().default(null),
  duplicatedFromTripId: plannerIdSchema.nullable().default(null),
  /** Bumped on every mutation of the trip or anything under it (ADR 0002 §6). */
  version: z.number().int().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ---------------------------------------------------------------------------
// Trip days — generated, never created by hand
// ---------------------------------------------------------------------------

export const tripDayUpdateSchema = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  note: noteSchema.unwrap().optional(),
});

export const tripDaySchema = z.object({
  id: plannerIdSchema,
  tripId: plannerIdSchema,
  /** Always 1..durationDays with no gaps — the repository owns that invariant. */
  dayNumber: dayNumberSchema,
  /** Derived from the trip's `startDate`; null when the trip has no dates. */
  date: isoDateSchema.nullable(),
  title: z.string().max(160).nullable(),
  note: z.string().max(2_000).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ---------------------------------------------------------------------------
// Trip activities — a catalog place, or something the traveller invented
// ---------------------------------------------------------------------------

const activityFieldsSchema = z.object({
  /**
   * `null` for a self-made activity; otherwise → `places.slug` in the catalog.
   * When it is set and `title` is omitted, the place's Vietnamese name is used.
   */
  placeSlug: slugSchema.nullable().default(null),
  title: titleSchema.optional(),
  startTime: timeOfDaySchema.nullable().default(null),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  estimatedCostVnd: vndSchema,
  costScope: costScopeSchema.default('group'),
  /**
   * Omitted means "work it out": a catalog place implies its own cost category
   * (a cafe is `food`), and a self-made activity falls back to `other`.
   */
  category: costCategorySchema.optional(),
  note: noteSchema,
});

export const tripActivityCreateSchema = activityFieldsSchema
  .extend({
    dayNumber: dayNumberSchema,
    /** Insert position within the day; omitted appends to the end. */
    toIndex: z.number().int().min(0).max(ACTIVITIES_PER_DAY_LIMIT - 1).optional(),
  })
  .refine((input) => input.title !== undefined || input.placeSlug !== null, {
    message: 'a self-made activity needs a title — only a catalog place can infer one',
    path: ['title'],
  });

/**
 * Moving an activity is `PATCH /reorder`, not a field update: an edit that
 * silently re-homed a row would make ordering unauditable.
 */
export const tripActivityUpdateSchema = z
  .object(withoutDefaults(activityFieldsSchema.shape))
  .partial()
  .omit({ placeSlug: true });

export const tripActivitySchema = z.object({
  id: plannerIdSchema,
  tripId: plannerIdSchema,
  dayId: plannerIdSchema,
  /** 0-based position within its day, contiguous by invariant. */
  order: z.number().int().min(0),
  placeSlug: slugSchema.nullable(),
  title: titleSchema,
  startTime: timeOfDaySchema.nullable(),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  estimatedCostVnd: vndSchema,
  costScope: costScopeSchema,
  category: costCategorySchema,
  note: z.string().max(2_000).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/**
 * One endpoint, two operations, discriminated explicitly so a malformed body
 * gets a precise error instead of "did not match any variant".
 */
export const plannerReorderSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('reorder-day'),
    dayNumber: dayNumberSchema,
    /** Must be a permutation of that day's activity ids — no adds, no drops. */
    activityIds: z.array(plannerIdSchema).min(1).max(ACTIVITIES_PER_DAY_LIMIT),
  }),
  z.object({
    op: z.literal('move-activity'),
    activityId: plannerIdSchema,
    toDayNumber: dayNumberSchema,
    toIndex: z.number().int().min(0).max(ACTIVITIES_PER_DAY_LIMIT - 1),
  }),
]);

// ---------------------------------------------------------------------------
// Trip expenses — what was actually paid
// ---------------------------------------------------------------------------

const expenseFieldsSchema = z.object({
  label: labelSchema,
  category: costCategorySchema,
  amountVnd: vndSchema,
  costScope: costScopeSchema.default('group'),
  /** Null for a whole-trip cost (a flight, a hotel booked as one line). */
  dayNumber: dayNumberSchema.nullable().default(null),
  /**
   * Links the payment to what it paid for. An activity's estimate is then
   * considered settled and is not projected again on top of it — this is the
   * mechanism that stops activity and expense being double-counted (§Budget).
   */
  activityId: plannerIdSchema.nullable().default(null),
  paidOn: isoDateSchema.nullable().default(null),
  note: noteSchema,
});

export const tripExpenseCreateSchema = expenseFieldsSchema;
export const tripExpenseUpdateSchema = z
  .object(withoutDefaults(expenseFieldsSchema.shape))
  .partial();

export const tripExpenseSchema = z.object({
  id: plannerIdSchema,
  tripId: plannerIdSchema,
  /** Resolved from `activityId` when one is given, so the two cannot disagree. */
  dayId: plannerIdSchema.nullable(),
  activityId: plannerIdSchema.nullable(),
  label: labelSchema,
  category: costCategorySchema,
  amountVnd: vndSchema,
  costScope: costScopeSchema,
  paidOn: isoDateSchema.nullable(),
  note: z.string().max(2_000).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const tripListQuerySchema = z.object({
  status: tripStatusSchema.optional(),
  destinationSlug: slugSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CostScope = z.infer<typeof costScopeSchema>;
export type TripStatus = z.infer<typeof tripStatusSchema>;
export type TripBudget = z.infer<typeof budgetSchema>;
export type PlannerUser = z.infer<typeof plannerUserSchema>;
export type PlannerUserRoleUpdate = z.infer<typeof plannerUserRoleUpdateSchema>;
export type PublicPlannerUser = z.infer<typeof publicPlannerUserSchema>;
export type PlannerUserCreateInput = z.infer<typeof plannerUserCreateSchema>;
export type Trip = z.infer<typeof tripSchema>;
export type TripCreateInput = z.infer<typeof tripCreateSchema>;
export type TripBlankCreateInput = z.infer<typeof tripBlankCreateSchema>;
export type TripFromTemplateCreateInput = z.infer<typeof tripFromTemplateCreateSchema>;
export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;
export type PlanningStatus = z.infer<typeof planningStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type TripListing = z.infer<typeof tripListingSchema>;
export type ListingDecision = z.infer<typeof listingDecisionSchema>['decision'];
export type ShareSettingsInput = z.infer<typeof shareSettingsSchema>;
export type TripDuplicateInput = z.infer<typeof tripDuplicateSchema>;
export type TripTemplateSnapshot = z.infer<typeof tripTemplateSnapshotSchema>;
export type TripDay = z.infer<typeof tripDaySchema>;
export type TripDayUpdateInput = z.infer<typeof tripDayUpdateSchema>;
export type TripActivity = z.infer<typeof tripActivitySchema>;
export type TripActivityCreateInput = z.infer<typeof tripActivityCreateSchema>;
export type TripActivityUpdateInput = z.infer<typeof tripActivityUpdateSchema>;
export type PlannerReorderInput = z.infer<typeof plannerReorderSchema>;
export type TripExpense = z.infer<typeof tripExpenseSchema>;
export type TripExpenseCreateInput = z.infer<typeof tripExpenseCreateSchema>;
export type TripExpenseUpdateInput = z.infer<typeof tripExpenseUpdateSchema>;
export type TripListQuery = z.infer<typeof tripListQuerySchema>;

// ---------------------------------------------------------------------------
// Browser sessions (ADR 0004)
// ---------------------------------------------------------------------------

/**
 * Session lifetime, on two axes. Both are single constants on purpose — the
 * owner left the exact numbers open, and changing them is a one-line edit.
 */
export const SESSION_ABSOLUTE_DAYS = 14;
export const SESSION_IDLE_DAYS = 7;

/**
 * Shorter lifetimes for an `admin` session (ADR 0010 §4). Chosen by the user's
 * *current* role each time the session is read, so demotion restores the
 * member lifetime and promotion shortens it.
 */
export const ADMIN_SESSION_ABSOLUTE_HOURS = 12;
export const ADMIN_SESSION_IDLE_HOURS = 2;
/** Admin sessions refresh `lastSeenAt` more often so a 2 h idle window stays accurate. */
export const ADMIN_SESSION_TOUCH_INTERVAL_MINUTES = 10;

/**
 * How stale `lastSeenAt` may get before a read bothers to update it. Idle
 * expiry needs the field to move, but writing on *every* request would turn
 * each GET into a store write and serialise the whole API behind it, so the
 * update is throttled. The cost is that idle expiry is accurate to the hour,
 * which is far finer than the 7-day window it enforces.
 */
export const SESSION_TOUCH_INTERVAL_MINUTES = 60;

/**
 * A session row. The cookie carries an opaque random token; what is stored is
 * its SHA-256 digest, exactly as with `PlannerUser.tokenHash`, so a leaked
 * store yields no usable session.
 */
export const plannerSessionSchema = z.object({
  id: plannerIdSchema,
  tokenHash: z.string().length(64),
  /** → `plannerUsers.id`. */
  userId: plannerIdSchema,
  createdAt: timestampSchema,
  /** Moved forward at most once per `SESSION_TOUCH_INTERVAL_MINUTES`. */
  lastSeenAt: timestampSchema,
  /** Absolute end of life, fixed at sign-in and never extended. */
  expiresAt: timestampSchema,
  /**
   * How the session was opened (ADR 0007). Absent reads as `token`. Only a
   * `password` session is held behind the temporary-password gate.
   */
  method: z.enum(['token', 'password', 'google']).optional(),
});

/**
 * Sign-in body: the access token the operator issued, or an email and a
 * password. Strict, so the two shapes cannot be mixed.
 */
export const signInSchema = z.union([
  z.object({ accessToken: z.string().trim().min(32).max(256) }).strict(),
  z
    .object({
      email: emailSchema,
      // Not `passwordSchema`: a too-short guess must get the same 401 as a
      // wrong one, not a 422 that says something about the account.
      password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    })
    .strict(),
]);

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: passwordSchema,
  })
  .strict();

/**
 * An in-flight Google sign-in (ADR 0007). The cookie carries the raw `state`;
 * only its digest is stored. One use, ten minutes.
 */
export const oauthAttemptSchema = z.object({
  id: plannerIdSchema,
  stateHash: z.string().length(64),
  nonce: z.string().min(16).max(128),
  codeVerifier: z.string().min(43).max(128),
  returnTo: z.string().max(300),
  locale: z.enum(['vi', 'en']),
  /**
   * Set when a signed-in user started the flow to *link* Google to their own
   * account, rather than to sign in. Linking is never inferred from an email.
   */
  linkUserId: plannerIdSchema.optional(),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
});

export const OAUTH_ATTEMPT_MINUTES = 10;
/**
 * Ceiling on in-flight Google attempts across all clients. Each start writes a
 * row, and the per-client limiter keys on a spoofable header, so this is what
 * actually bounds the store's growth.
 */
export const MAX_LIVE_OAUTH_ATTEMPTS = 500;

export type PlannerSession = z.infer<typeof plannerSessionSchema>;
export type SessionMethod = NonNullable<PlannerSession['method']>;
export type SignInInput = z.infer<typeof signInSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type OAuthAttempt = z.infer<typeof oauthAttemptSchema>;

// ---------------------------------------------------------------------------
// Public, read-only view of a shared trip (ADR 0005)
// ---------------------------------------------------------------------------

/**
 * What an unauthenticated reader of a share link may see. It is built by an
 * allow-list in `getSharedTrip` — never by spreading a `Trip` — so a field
 * added to `Trip` later is private until someone names it here on purpose.
 * Deliberately absent: owner, every id, version, share fields, the trip note,
 * and all expenses.
 */
export interface SharedTripView {
  title: string;
  destinationSlug: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  partySize: number;
  travelStyle: Trip['travelStyle'];
  pace: Trip['pace'];
  planningStatus: PlanningStatus;
  visibility: 'unlisted' | 'public';
  days: Array<{
    dayNumber: number;
    title: string | null;
    date: string | null;
    activities: Array<{
      order: number;
      title: string;
      placeSlug: string | null;
      startTime: string | null;
      endTime: string | null;
      category: TripActivity['category'];
      note: string | null;
    }>;
  }>;
  budget: {
    currency: 'VND';
    targetTotalVnd: number | null;
    estimatedTotalVnd: number;
    /** Paid + the estimate of what is not yet paid. A total only — no expense row. */
    projectedTotalVnd: number;
    /** Projection above the target; 0 when it fits or no target is set. */
    overrunVnd: number;
    /** Each traveller's share of the overrun, rounded up. */
    overrunPerPersonVnd: number;
  };
  attribution: {
    templateTitle: TripTemplateSnapshot['title'];
    story: { slug: string; title: TripTemplateSnapshot['title'] } | null;
    clonedAt: string;
  } | null;
}

/**
 * The public gallery card (ADR 0014). An allow-list: every field is named in
 * `buildCommunityCard`, nothing is spread. `author` is `null` for anonymous —
 * never an email, user id or `ownerId`.
 */
export interface CommunityTripCard {
  shareToken: string;
  title: string;
  destinationSlug: string;
  durationDays: number;
  partySize: number;
  travelStyle: Trip['travelStyle'];
  activityCount: number;
  author: string | null;
  approvedAt: string;
}

/** A row of the staff queue. Staff-only: carries the share link and the owner's display name. */
export interface ListingQueueItem {
  tripId: string;
  title: string;
  destinationSlug: string;
  durationDays: number;
  activityCount: number;
  ownerDisplayName: string;
  shareToken: string | null;
  listing: TripListing;
}

/** What the share endpoints return to the owner. */
export interface ShareState {
  visibility: Visibility;
  shareToken: string | null;
  shareTokenCreatedAt: string | null;
  listing: TripListing | null;
}

// ---------------------------------------------------------------------------
// Community place reviews (ADR 0014, PR 2)
// ---------------------------------------------------------------------------

export const REVIEW_BODY_MIN = 60;
export const REVIEW_BODY_MAX = 1_000;
/** A rating average is only shown from this many approved reviews. */
export const MIN_REVIEWS_FOR_AVERAGE = 3;

export const reviewSourceSchema = z.enum(['planner', 'homepage']);
export const reviewStatusSchema = z.enum(['pending', 'approved', 'rejected', 'removed']);
export const reviewLangSchema = z.enum(['vi', 'en']);

/**
 * A traveller's review of a catalogue place. `source` decides moderation:
 * `planner` (signed in) starts `pending`; `homepage` (anyone) is published at
 * once and staff can only remove it afterwards. Plain text — always rendered as
 * text, never HTML.
 */
export const communityReviewSchema = z.object({
  id: plannerIdSchema,
  source: reviewSourceSchema,
  /** The signed-in author; `null` for a guest. */
  authorId: plannerIdSchema.nullable(),
  placeSlug: slugSchema,
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(REVIEW_BODY_MIN).max(REVIEW_BODY_MAX),
  lang: reviewLangSchema,
  visitedOn: isoDateSchema,
  /** Shown name; `null` is anonymous. A snapshot — never an email or id. */
  authorName: z.string().trim().min(2).max(60).nullable(),
  status: reviewStatusSchema,
  /** SHA-256 prefix of the guest's client key: dedupe only, never an address. */
  guestKey: z.string().max(64).nullable().default(null),
  decidedAt: timestampSchema.nullable().default(null),
  decidedBy: z.string().max(80).nullable().default(null),
  rejectReason: z.string().max(500).nullable().default(null),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const reviewFields = {
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(REVIEW_BODY_MIN).max(REVIEW_BODY_MAX),
  lang: reviewLangSchema,
  visitedOn: isoDateSchema,
};

/** `PUT /api/planner/reviews/[placeSlug]` body. Strict. */
export const plannerReviewInputSchema = z
  .object({ ...reviewFields, authorDisplay: authorDisplaySchema })
  .strict();

/**
 * `POST /api/community/reviews` body. `website` is a honeypot: real users never
 * fill it, a bot usually does — the route drops those silently.
 */
export const guestReviewInputSchema = z
  .object({
    placeSlug: slugSchema,
    ...reviewFields,
    authorName: z.string().trim().min(2).max(60).nullable().default(null),
    website: z.string().max(200).optional(),
  })
  .strict();

/** `PATCH /api/admin/community/reviews/[id]` body. */
export const reviewDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'remove']),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict()
  .refine((value) => value.decision === 'approve' || value.reason !== undefined, {
    message: 'a reason is required to reject or remove',
    path: ['reason'],
  });

export type CommunityReview = z.infer<typeof communityReviewSchema>;
export type PlannerReviewInput = z.infer<typeof plannerReviewInputSchema>;
export type GuestReviewInput = z.infer<typeof guestReviewInputSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

/**
 * The public review. An allow-list built field by field: no id, author id,
 * guest key, moderation field or source. Always self-reported, never "verified".
 */
export interface PublicCommunityReview {
  placeSlug: string;
  rating: number;
  body: string;
  lang: 'vi' | 'en';
  visitedOn: string;
  author: string | null;
  createdAt: string;
}

export interface PlaceReviewSummary {
  count: number;
  /** One decimal; `null` below `MIN_REVIEWS_FOR_AVERAGE` approved reviews. */
  average: number | null;
}

/** A row of the staff review queue. */
export interface ReviewQueueItem {
  id: string;
  source: 'planner' | 'homepage';
  placeSlug: string;
  rating: number;
  body: string;
  lang: 'vi' | 'en';
  visitedOn: string;
  author: string | null;
  authorAccount: string | null;
  status: ReviewStatus;
  rejectReason: string | null;
  createdAt: string;
}

/** What an author sees of their own review. */
export interface OwnReview {
  placeSlug: string;
  rating: number;
  body: string;
  lang: 'vi' | 'en';
  visitedOn: string;
  authorDisplay: 'name' | 'anonymous';
  status: ReviewStatus;
  rejectReason: string | null;
  updatedAt: string;
}
