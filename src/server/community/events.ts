import type { AuditEvent } from '@/server/planner/schemas';
import type { PlannerData } from '@/server/planner/store';

/**
 * Append-only community audit log (ADR 0019 §2, batch 10.2).
 *
 * `appendEvent` is called **inside** the Planner-store transaction that makes
 * the change it describes, so the two commit or roll back together. This module
 * deliberately exports no update or delete: the only removal is the one-year
 * retention sweep, run as events are appended.
 *
 * Privacy: never pass a guest key, an email or a free-text body. `reason` is
 * capped at 500 characters here as well as at the route boundary.
 */

/** Retention (owner decision D3): events older than this are swept. */
export const AUDIT_RETENTION_DAYS = 365;
const REASON_MAX = 500;
const ACTOR_MAX = 80;

/** What a caller supplies; the id and the timestamp come from the repository. */
export type NewAuditEvent = Omit<AuditEvent, 'id' | 'createdAt' | 'reason' | 'actorKind'> & {
  reason?: string | null;
  /** Defaults from `actorId`: `service` / `account deleted` / `system` are services. */
  actorKind?: AuditEvent['actorKind'];
};

/** The service token, the account-delete cascade and the implicit listing end are not a person. */
export function actorKindOf(actorId: string): AuditEvent['actorKind'] {
  return actorId === 'service' || actorId === 'account deleted' || actorId === 'system' ? 'service' : 'user';
}

/**
 * Adds one event to `data.auditEvents` and drops those past retention.
 * `env.id` and `env.at` are supplied by the caller so ids and time stay under
 * the repository's injected generators (deterministic in tests).
 */
export function appendEvent(
  data: Pick<PlannerData, 'auditEvents'>,
  event: NewAuditEvent,
  env: { id: string; at: string },
): AuditEvent {
  const actorId = event.actorId.slice(0, ACTOR_MAX);
  const row: AuditEvent = {
    id: env.id,
    targetKind: event.targetKind,
    targetId: event.targetId,
    actorId,
    actorKind: event.actorKind ?? actorKindOf(actorId),
    action: event.action,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason ? event.reason.slice(0, REASON_MAX) : null,
    createdAt: env.at,
  };
  const cutoff = new Date(Date.parse(env.at) - AUDIT_RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  data.auditEvents = data.auditEvents.filter((existing) => existing.createdAt >= cutoff);
  data.auditEvents.push(row);
  return row;
}

/**
 * The one named exception to "append-only" (ADR 0024 §8, guest review erasure):
 * blanks the staff-typed `reason` of the events on `targetIds`, because it may
 * quote erased text. Action, actor, statuses and time stay, and so does any
 * `erase` event (the proof the request was handled). Returns how many changed.
 */
export function redactEventReasons(data: Pick<PlannerData, 'auditEvents'>, targetIds: ReadonlySet<string>): number {
  let changed = 0;
  data.auditEvents = data.auditEvents.map((event) => {
    if (event.reason === null || event.action === 'erase' || !targetIds.has(event.targetId)) return event;
    changed += 1;
    return { ...event, reason: null };
  });
  return changed;
}

/** Newest first; the staff route's order. */
export function eventsForTarget(data: Pick<PlannerData, 'auditEvents'>, targetId: string): AuditEvent[] {
  return data.auditEvents
    .filter((event) => event.targetId === targetId)
    .reverse() // insertion order is oldest first; the stable sort keeps ties newest first
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 200);
}
