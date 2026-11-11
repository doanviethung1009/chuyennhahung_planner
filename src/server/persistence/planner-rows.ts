import { ContentError } from '@/server/content/errors';
import { normalizeVnd } from '@/server/planner/money';
import {
  oauthAttemptSchema,
  plannerSessionSchema,
  plannerUserSchema,
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

type ColumnType = 'text' | 'int' | 'bigint' | 'bool' | 'timestamptz' | 'date' | 'jsonb';

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

interface TableSpec {
  collection: PlannerCollection;
  table: string;
  columns: Column[];
  parse: (record: unknown) => Record_;
}

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
export const TABLES: readonly TableSpec[] = [
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
  return new Error(`planner row ${spec.table}/${String(row.id)} is unreadable: ${reason}`);
}

export function rowsToData(rowsByTable: Record<string, Row[]>): PlannerData {
  const data: Record<string, unknown[]> = {};
  for (const spec of TABLES) {
    data[spec.collection] = (rowsByTable[spec.table] ?? []).map((row) => fromRow(spec, row));
  }
  return data as unknown as PlannerData;
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
  return column.type === 'jsonb' ? `$${index}::jsonb` : `$${index}`;
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
    (c) => c.column !== 'id' && canonical(before[c.column]) !== canonical(after[c.column]),
  );
  if (changed.length === 0) return null;
  const assignments = changed.map((c, i) => `${quote(c.column)} = ${placeholder(c, i + 2)}`);
  return {
    kind: 'update',
    table: spec.table,
    text: `UPDATE ${quote(spec.table)} SET ${assignments.join(', ')} WHERE "id" = $1`,
    values: [after.id, ...changed.map((c) => after[c.column])],
  };
}

function deleteStatement(spec: TableSpec, ids: string[]): Statement {
  return {
    kind: 'delete',
    table: spec.table,
    text: `DELETE FROM ${quote(spec.table)} WHERE "id" = ANY($1::text[])`,
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
export function planStatements(before: PlannerData, after: PlannerData): Statement[] {
  const inserts: Statement[] = [];
  const updates: Statement[] = [];
  const deletes: Statement[] = [];

  for (const spec of TABLES) {
    const was = new Map<string, Row>();
    for (const record of before[spec.collection] as Record_[]) {
      was.set(String(record.id), toRow(spec, record));
    }
    const seen = new Set<string>();

    for (const record of after[spec.collection] as Record_[]) {
      const id = String(record.id);
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
