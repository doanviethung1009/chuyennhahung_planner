import { ContentError } from '@/server/content/errors';
import { normalizeVnd } from '@/server/planner/money';
import {
  communityReviewSchema,
  oauthAttemptSchema,
  plannerSessionSchema,
  plannerUserSchema,
  reviewRestrictionSchema,
  auditEventSchema,
  termsAcceptanceSchema,
  tripActivitySchema,
  tripDaySchema,
  tripExpenseSchema,
  tripSchema,
} from '@/server/planner/schemas';
import type { PlannerData } from '@/server/planner/store';

/**
 * The pure half of the Postgres Planner store (ADR 0009 §2–§3): the table
 * layout, the record <-> row mapping, and the diff that turns "what the
 * repository changed" into the smallest set of INSERT / UPDATE / DELETE
 * statements. Nothing here touches a driver or a socket, so all of it is unit
 * tested offline.
 *
 * Every identifier in a statement comes from the static `TABLES` list below —
 * never from a request — and every value travels as a bind parameter. A
 * statement is `{ text, values }` and nothing is ever interpolated into `text`
 * except those quoted, constant identifiers and positional `$n` markers.
 */

type ColumnType =
  | 'text'
  | 'int'
  | 'float'
  | 'bigint'
  | 'bool'
  | 'timestamptz'
  | 'date'
  | 'jsonb'
  | 'textarray';

/**
 * How a NULL in the database reads back:
 * - `required`  — never NULL; a NULL is a corrupt row.
 * - `nullable`  — the schema says `T | null`; NULL reads as `null`.
 * - `optional`  — the schema says `.optional()`; NULL reads as *absent*, so the
 *   record equals what the JSON store would return for a record that omitted it.
 */
type ColumnMode = 'required' | 'nullable' | 'optional';

type Row = Record<string, unknown>;
type Record_ = Record<string, unknown>;

interface Column {
  column: string;
  field: string;
  type: ColumnType;
  mode: ColumnMode;
  /** For a column that is not a top-level field (the trip budget). */
  get?: (record: Record_) => unknown;
  set?: (record: Record_, value: unknown) => void;
}

export type PlannerCollection = keyof PlannerData;

/**
 * One table of a document store. The engine below is shared by the Planner and
 * the Travel Content store (ADR 0013): a store is a list of these, parents
 * first. The key defaults to `id`; content entities are keyed by `slug`.
 */
export interface TableSpec<C extends string = string> {
  collection: C;
  table: string;
  /** The record field and the column that identify a row. Default `id`. */
  key?: { field: string; column: string };
  columns: Column[];
  parse: (record: unknown) => Record_;
}

export type { Column };

const keyOf = (spec: TableSpec): { field: string; column: string } =>
  spec.key ?? { field: 'id', column: 'id' };

type CollectionsOf = Record<string, unknown[]>;

const col = (
  field: string,
  column: string,
  type: ColumnType,
  mode: ColumnMode = 'required',
): Column => ({ column, field, type, mode });

const createdUpdated = [
  col('createdAt', 'created_at', 'timestamptz'),
  col('updatedAt', 'updated_at', 'timestamptz'),
];

/** Parents first. Deletes walk this list backwards. */
export const TABLES: readonly TableSpec<PlannerCollection>[] = [
  {
    collection: 'users',
    table: 'planner_users',
    parse: (r) => plannerUserSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('handle', 'handle', 'text'),
      col('displayName', 'display_name', 'text'),
      col('tokenHash', 'token_hash', 'text'),
      ...createdUpdated,
      col('email', 'email', 'text', 'optional'),
      col('passwordHash', 'password_hash', 'text', 'optional'),
      col('mustChangePassword', 'must_change_password', 'bool', 'optional'),
      col('googleSub', 'google_sub', 'text', 'optional'),
      col('createdVia', 'created_via', 'text', 'optional'),
      // ADR 0006; added by migration 0002.
      col('role', 'role', 'text', 'optional'),
      // ADR 0017; added by migration 0009. NULL reads as absent (= active).
      col('bannedAt', 'banned_at', 'timestamptz', 'optional'),
      col('bannedBy', 'banned_by', 'text', 'optional'),
      col('deletedAt', 'deleted_at', 'timestamptz', 'optional'),
      col('deletedBy', 'deleted_by', 'text', 'optional'),
    ],
  },
  {
    collection: 'sessions',
    table: 'planner_sessions',
    parse: (r) => plannerSessionSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('tokenHash', 'token_hash', 'text'),
      col('userId', 'user_id', 'text'),
      col('createdAt', 'created_at', 'timestamptz'),
      col('lastSeenAt', 'last_seen_at', 'timestamptz'),
      col('expiresAt', 'expires_at', 'timestamptz'),
      col('method', 'method', 'text', 'optional'),
    ],
  },
  {
    collection: 'oauthAttempts',
    table: 'planner_oauth_attempts',
    parse: (r) => oauthAttemptSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('stateHash', 'state_hash', 'text'),
      col('nonce', 'nonce', 'text'),
      col('codeVerifier', 'code_verifier', 'text'),
      col('returnTo', 'return_to', 'text'),
      col('locale', 'locale', 'text'),
      col('linkUserId', 'link_user_id', 'text', 'optional'),
      col('createdAt', 'created_at', 'timestamptz'),
      col('expiresAt', 'expires_at', 'timestamptz'),
    ],
  },
  {
    collection: 'trips',
    table: 'trips',
    parse: (r) => tripSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('ownerId', 'owner_id', 'text'),
      col('title', 'title', 'text'),
      col('destinationSlug', 'destination_slug', 'text'),
      col('startDate', 'start_date', 'date', 'nullable'),
      col('endDate', 'end_date', 'date', 'nullable'),
      col('durationDays', 'duration_days', 'int'),
      col('partySize', 'party_size', 'int'),
      col('travelStyle', 'travel_style', 'text', 'nullable'),
      col('pace', 'pace', 'text', 'nullable'),
      {
        column: 'budget_target_total_vnd',
        field: 'budget',
        type: 'bigint',
        mode: 'required',
        get: (record) => (record.budget as { targetTotalVnd: unknown }).targetTotalVnd,
        set: (record, value) => {
          record.budget = { targetTotalVnd: value, currency: 'VND' };
        },
      },
      col('note', 'note', 'text', 'nullable'),
      col('status', 'status', 'text'),
      col('archivedAt', 'archived_at', 'timestamptz', 'nullable'),
      col('sourceTemplate', 'source_template', 'jsonb', 'nullable'),
      col('planningStatus', 'planning_status', 'text'),
      col('visibility', 'visibility', 'text'),
      col('shareToken', 'share_token', 'text', 'nullable'),
      col('shareTokenCreatedAt', 'share_token_created_at', 'timestamptz', 'nullable'),
      col('listing', 'listing', 'jsonb', 'nullable'),
      col('duplicatedFromTripId', 'duplicated_from_trip_id', 'text', 'nullable'),
      col('version', 'version', 'int'),
      ...createdUpdated,
    ],
  },
  {
    collection: 'tripDays',
    table: 'trip_days',
    parse: (r) => tripDaySchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('tripId', 'trip_id', 'text'),
      col('dayNumber', 'day_number', 'int'),
      col('date', 'date', 'date', 'nullable'),
      col('title', 'title', 'text', 'nullable'),
      col('note', 'note', 'text', 'nullable'),
      ...createdUpdated,
    ],
  },
  {
    collection: 'tripActivities',
    table: 'trip_activities',
    parse: (r) => tripActivitySchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('tripId', 'trip_id', 'text'),
      col('dayId', 'day_id', 'text'),
      col('order', 'sort_order', 'int'),
      col('placeSlug', 'place_slug', 'text', 'nullable'),
      col('title', 'title', 'text'),
      col('startTime', 'start_time', 'text', 'nullable'),
      col('durationMinutes', 'duration_minutes', 'int'),
      col('estimatedCostVnd', 'estimated_cost_vnd', 'bigint'),
      col('costScope', 'cost_scope', 'text'),
      col('category', 'category', 'text'),
      col('note', 'note', 'text', 'nullable'),
      ...createdUpdated,
    ],
  },
  {
    collection: 'tripExpenses',
    table: 'trip_expenses',
    parse: (r) => tripExpenseSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('tripId', 'trip_id', 'text'),
      col('dayId', 'day_id', 'text', 'nullable'),
      col('activityId', 'activity_id', 'text', 'nullable'),
      col('label', 'label', 'text'),
      col('category', 'category', 'text'),
      col('amountVnd', 'amount_vnd', 'bigint'),
      col('costScope', 'cost_scope', 'text'),
      col('paidOn', 'paid_on', 'date', 'nullable'),
      col('note', 'note', 'text', 'nullable'),
      ...createdUpdated,
    ],
  },
  {
    // ADR 0014 PR 2. No foreign key to planner_users (ADR 0013): a guest review has no author.
    collection: 'communityReviews',
    table: 'community_reviews',
    parse: (r) => communityReviewSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('source', 'source', 'text'),
      col('authorId', 'author_id', 'text', 'nullable'),
      col('placeSlug', 'place_slug', 'text'),
      col('rating', 'rating', 'int'),
      col('body', 'body', 'text'),
      col('lang', 'lang', 'text'),
      col('visitedOn', 'visited_on', 'date'),
      col('authorName', 'author_name', 'text', 'nullable'),
      col('status', 'status', 'text'),
      col('guestKey', 'guest_key', 'text', 'nullable'),
      col('decidedAt', 'decided_at', 'timestamptz', 'nullable'),
      col('decidedBy', 'decided_by', 'text', 'nullable'),
      col('rejectReason', 'reject_reason', 'text', 'nullable'),
      ...createdUpdated,
    ],
  },
  {
    // ADR 0015. No foreign keys (ADR 0013). Rows are never deleted by staff: lifting sets lifted_at.
    collection: 'reviewRestrictions',
    table: 'review_restrictions',
    parse: (r) => reviewRestrictionSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('subject', 'subject', 'text'),
      col('authorId', 'author_id', 'text', 'nullable'),
      col('guestKey', 'guest_key', 'text', 'nullable'),
      col('placeSlug', 'place_slug', 'text', 'nullable'),
      col('reason', 'reason', 'text'),
      col('createdAt', 'created_at', 'timestamptz'),
      col('createdBy', 'created_by', 'text'),
      col('expiresAt', 'expires_at', 'timestamptz', 'nullable'),
      col('liftedAt', 'lifted_at', 'timestamptz', 'nullable'),
      col('liftedBy', 'lifted_by', 'text', 'nullable'),
    ],
  },
  {
    // ADR 0019. Append-only; no foreign keys (ADR 0013). Swept after one year.
    collection: 'auditEvents',
    table: 'audit_events',
    parse: (r) => auditEventSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('targetKind', 'target_kind', 'text'),
      col('targetId', 'target_id', 'text'),
      col('actorId', 'actor_id', 'text'),
      col('actorKind', 'actor_kind', 'text'),
      col('action', 'action', 'text'),
      col('fromStatus', 'from_status', 'text', 'nullable'),
      col('toStatus', 'to_status', 'text', 'nullable'),
      col('reason', 'reason', 'text', 'nullable'),
      col('createdAt', 'created_at', 'timestamptz'),
    ],
  },
  {
    // ADR 0019 §4. Personal data; no foreign keys (ADR 0013). Unique (user_id, version).
    collection: 'termsAcceptances',
    table: 'terms_acceptances',
    parse: (r) => termsAcceptanceSchema.parse(r),
    columns: [
      col('id', 'id', 'text'),
      col('userId', 'user_id', 'text'),
      col('version', 'version', 'text'),
      col('acceptedAt', 'accepted_at', 'timestamptz'),
      col('lang', 'lang', 'text'),
    ],
  },
];

export const PLANNER_TABLE_NAMES = TABLES.map((spec) => spec.table);

// ---------------------------------------------------------------------------
// Record -> row
// ---------------------------------------------------------------------------

function valueOf(column: Column, record: Record_): unknown {
  const raw = column.get ? column.get(record) : record[column.field];
  return raw === undefined ? null : raw;
}

/**
 * The database-ready value for one column: ISO timestamps normalised (so two
 * spellings of one instant compare equal), JSONB as text, amounts checked
 * through the money boundary. `null` for an absent optional field.
 */
function toDbValue(column: Column, raw: unknown): unknown {
  if (raw === null) return null;
  switch (column.type) {
    case 'timestamptz': {
      const time = new Date(raw as string | Date);
      if (Number.isNaN(time.getTime())) {
        throw new Error(`invalid timestamp in column ${column.column}`);
      }
      return time.toISOString();
    }
    case 'jsonb':
      return JSON.stringify(raw);
    case 'bigint':
      return normalizeVnd(raw, column.column);
    case 'textarray':
      return raw as string[];
    default:
      return raw;
  }
}

export function toRow(spec: TableSpec, record: Record_): Row {
  const row: Row = {};
  for (const column of spec.columns) {
    row[column.column] = toDbValue(column, valueOf(column, record));
  }
  return row;
}

// ---------------------------------------------------------------------------
// Row -> record
// ---------------------------------------------------------------------------

function fromDbValue(column: Column, raw: unknown): unknown {
  switch (column.type) {
    case 'timestamptz':
      return (raw instanceof Date ? raw : new Date(raw as string)).toISOString();
    case 'date':
      // The pool's type parser keeps DATE as the `YYYY-MM-DD` text Postgres
      // sent. A Date means the parser was not installed: read it in UTC rather
      // than guess a local zone.
      return raw instanceof Date ? raw.toISOString().slice(0, 10) : raw;
    case 'bigint':
      return normalizeVnd(raw, column.column);
    case 'jsonb':
      return typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    default:
      return raw;
  }
}

/**
 * Builds a record from a driver row and parses it with the same zod schema the
 * repository's types are inferred from. A row that fails is reported by table
 * and id only — never its content, which may be a traveller's private note.
 */
export function fromRow(spec: TableSpec, row: Row): Record_ {
  const record: Record_ = {};
  for (const column of spec.columns) {
    const raw = row[column.column];
    if (raw === null || raw === undefined) {
      if (column.mode === 'required') {
        throw corrupt(spec, row, `${column.column} is NULL`);
      }
      if (column.mode === 'nullable') {
        if (column.set) column.set(record, null);
        else record[column.field] = null;
      }
      continue; // optional: left absent
    }
    const value = fromDbValue(column, raw);
    if (column.set) column.set(record, value);
    else record[column.field] = value;
  }
  try {
    return spec.parse(record);
  } catch {
    throw corrupt(spec, row, 'the row does not satisfy its schema');
  }
}

function corrupt(spec: TableSpec, row: Row, reason: string): Error {
  return new Error(`row ${spec.table}/${String(row[keyOf(spec).column])} is unreadable: ${reason}`);
}

export function rowsToData<T = PlannerData>(
  rowsByTable: Record<string, Row[]>,
  tables: readonly TableSpec[] = TABLES,
): T {
  const data: Record<string, unknown[]> = {};
  for (const spec of tables) {
    data[spec.collection] = (rowsByTable[spec.table] ?? []).map((row) => fromRow(spec, row));
  }
  return data as unknown as T;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export interface Statement {
  kind: 'insert' | 'update' | 'delete';
  table: string;
  text: string;
  values: unknown[];
}

const quote = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

/** Sorted-key JSON, so two rows compare equal regardless of key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
      );
    }
    return item;
  });
}

function placeholder(column: Column, index: number): string {
  if (column.type === 'jsonb') return `$${index}::jsonb`;
  if (column.type === 'textarray') return `$${index}::text[]`;
  return `$${index}`;
}

function insertStatement(spec: TableSpec, row: Row): Statement {
  const names = spec.columns.map((c) => quote(c.column)).join(', ');
  const marks = spec.columns.map((c, i) => placeholder(c, i + 1)).join(', ');
  return {
    kind: 'insert',
    table: spec.table,
    text: `INSERT INTO ${quote(spec.table)} (${names}) VALUES (${marks})`,
    values: spec.columns.map((c) => row[c.column]),
  };
}

function updateStatement(spec: TableSpec, before: Row, after: Row): Statement | null {
  const changed = spec.columns.filter(
    (c) => c.column !== keyOf(spec).column && canonical(before[c.column]) !== canonical(after[c.column]),
  );
  if (changed.length === 0) return null;
  const assignments = changed.map((c, i) => `${quote(c.column)} = ${placeholder(c, i + 2)}`);
  return {
    kind: 'update',
    table: spec.table,
    text: `UPDATE ${quote(spec.table)} SET ${assignments.join(', ')} WHERE ${quote(keyOf(spec).column)} = $1`,
    values: [after[keyOf(spec).column], ...changed.map((c) => after[c.column])],
  };
}

function deleteStatement(spec: TableSpec, ids: string[]): Statement {
  return {
    kind: 'delete',
    table: spec.table,
    text: `DELETE FROM ${quote(spec.table)} WHERE ${quote(keyOf(spec).column)} = ANY($1::text[])`,
    values: [ids],
  };
}

/**
 * The statements that turn `before` into `after`, per collection by `id`, in a
 * foreign-key-safe order: every INSERT parents-first, then every UPDATE, then
 * every DELETE children-first. Updates run before deletes so a row that is
 * re-pointed away from a doomed parent (an expense losing its activity) is
 * already clear of it. A mutation that changed nothing yields `[]`.
 *
 * Both sides are mapped to rows first, so a difference that only exists in the
 * record's spelling — a timestamp with and without milliseconds, an explicit
 * `null` against an absent optional — is not a change.
 */
export function planStatements<T extends object = PlannerData>(
  before: T,
  after: T,
  tables: readonly TableSpec[] = TABLES,
): Statement[] {
  const beforeSets = before as unknown as CollectionsOf;
  const afterSets = after as unknown as CollectionsOf;
  const inserts: Statement[] = [];
  const updates: Statement[] = [];
  const deletes: Statement[] = [];

  for (const spec of tables) {
    const keyField = keyOf(spec).field;
    const was = new Map<string, Row>();
    for (const record of beforeSets[spec.collection] as Record_[]) {
      was.set(String(record[keyField]), toRow(spec, record));
    }
    const seen = new Set<string>();

    for (const record of afterSets[spec.collection] as Record_[]) {
      const id = String(record[keyField]);
      if (seen.has(id)) {
        // Two rows with one id would make the diff order-dependent; the
        // repository never does this, so refuse rather than guess.
        throw new ContentError('invalid_state', `duplicate id "${id}" in ${spec.table}`);
      }
      seen.add(id);
      const row = toRow(spec, record);
      const previous = was.get(id);
      if (!previous) {
        inserts.push(insertStatement(spec, row));
      } else {
        const update = updateStatement(spec, previous, row);
        if (update) updates.push(update);
      }
    }

    const gone = [...was.keys()].filter((id) => !seen.has(id));
    if (gone.length > 0) deletes.unshift(deleteStatement(spec, gone));
  }

  return [...inserts, ...updates, ...deletes];
}
