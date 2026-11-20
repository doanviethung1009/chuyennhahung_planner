import { createHash, randomBytes } from 'node:crypto';
import type { MemberMapShareName, Trip } from './schemas';

/**
 * Pure half of member-map sharing (ADR 0030, slice 2a): the share token, the
 * name guard and the public projection. No I/O here, so every rule is tested
 * offline and the repository stays a thin transaction around it.
 */

/** A fresh share token: 32 random bytes, base64url (43 characters). Shown once, never stored. */
export function newMapShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of a token — the only form that is stored (ADR 0030 §1). */
export function mapShareDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * The public type (ADR 0030 §2). Deliberately **not** slice 1's private point:
 * a planned point has no way to be serialised through this one. Nothing else may
 * be added to it without an ADR and a change to the enumerating test.
 */
export interface PublicMemberMapPoint {
  slug: string;
  visitsBucket: 1 | 2 | 3;
}
export interface PublicMemberMap {
  displayName: string | null;
  points: PublicMemberMapPoint[];
}

/** 1 trip → 1, 2–3 → 2, 4 or more → 3. */
export function visitsBucket(trips: number): 1 | 2 | 3 {
  if (trips >= 4) return 3;
  if (trips >= 2) return 2;
  return 1;
}

/**
 * Visited places of one member, as an allow-list projection: trips with
 * `planningStatus = completed`, archived or not, to a destination the catalog
 * knows. Reviews, planned trips, dates, ids and titles are never read. Sorted by
 * slug, so the order carries no timeline.
 */
export function buildPublicMemberMapPoints(
  trips: ReadonlyArray<Pick<Trip, 'ownerId' | 'destinationSlug' | 'planningStatus'>>,
  ownerId: string,
  isKnownDestination: (slug: string) => boolean,
): PublicMemberMapPoint[] {
  const counts = new Map<string, number>();
  for (const trip of trips) {
    if (trip.ownerId !== ownerId || trip.planningStatus !== 'completed') continue;
    if (!isKnownDestination(trip.destinationSlug)) continue;
    counts.set(trip.destinationSlug, (counts.get(trip.destinationSlug) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([slug, count]) => ({ slug, visitsBucket: visitsBucket(count) }));
}

/**
 * Whether a display name is safe to show publicly (ADR 0030 §3): it must not
 * look like an email address (`@`), a web address, or a phone number (7 or more
 * digits). The text is NFKC-normalised first, so full-width forms (`＠`, `０９１２`)
 * are judged as their ASCII equivalents, and every Unicode decimal digit counts,
 * not only ASCII. A guard against accidents, not proof of identity safety.
 */
export function isDisplayNameSuitable(displayName: string): boolean {
  const text = displayName.normalize('NFKC');
  if (text.includes('@')) return false;
  if (/https?:|www\.|\b[\p{L}\p{N}-]+\.(?:com|net|org|vn|io|me|info|biz|app|dev|xyz)\b/iu.test(text)) {
    return false;
  }
  const digits = text.match(/\p{Nd}/gu)?.length ?? 0;
  return digits < 7;
}

/** What the owner sees (never the token). */
export interface MemberMapShareStatus {
  enabled: boolean;
  shareName: MemberMapShareName;
  /** Visited places the public map would show now; fewer than 2 is a warning, not a block. */
  visitedPlaces: number;
  sparse: boolean;
}
