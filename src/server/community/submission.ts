/**
 * Moderation state machine for community submissions (ADR 0019 §1,
 * docs/specs-community-moderation.md). Pure: no I/O, no role checks — callers
 * authorise with `can()` first and keep throwing `invalid_state` when
 * `transition` returns `null`.
 *
 * Only the states that map onto a stored `listing` are reachable today
 * (`pending`, `published`, `rejected`, and `draft` = no listing). The other
 * states are part of the table so later slices add them without reshaping it.
 */

export type SubmissionState =
  | 'draft'
  | 'pending'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'unpublished'
  | 'removed'
  | 'archived';

export type SubmissionAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'resubmit'
  | 'publish'
  | 'unpublish'
  | 'edit_material'
  | 'remove'
  | 'rework'
  | 'archive'
  | 'restore'
  | 'admin_restore';

/** Allowed edges, straight from the diagram in the moderation spec. */
const EDGES: Readonly<
  Record<SubmissionState, Partial<Readonly<Record<SubmissionAction, SubmissionState>>>>
> = {
  draft: { submit: 'pending', archive: 'archived' },
  pending: { approve: 'approved', reject: 'rejected', request_changes: 'changes_requested' },
  changes_requested: { resubmit: 'pending' },
  approved: { publish: 'published' },
  published: { unpublish: 'unpublished', edit_material: 'pending', remove: 'removed' },
  rejected: { rework: 'draft' },
  unpublished: { rework: 'draft', archive: 'archived' },
  archived: { restore: 'draft' },
  removed: { admin_restore: 'unpublished' },
};

/** The next state, or `null` when the edge is forbidden. */
export function transition(
  state: SubmissionState,
  action: SubmissionAction,
): SubmissionState | null {
  return EDGES[state][action] ?? null;
}

// ---------------------------------------------------------------------------
// Mapping to the stored `listing` (shape and values unchanged)
// ---------------------------------------------------------------------------

export type ListingStatus = 'pending' | 'approved' | 'rejected';

/** `none` (null) ↔ `draft`, `pending`, `approved` ↔ `published`, `rejected`. */
export function listingToState(status: ListingStatus | null): SubmissionState {
  if (status === null) return 'draft';
  if (status === 'approved') return 'published';
  return status;
}

/**
 * The stored form of a state, `null` meaning "no listing". `removed` is stored
 * as `rejected` (legacy edge c) until a later slice adds `unpublished` to the
 * data. States with no stored form throw: that is a programming error, never
 * user input.
 */
export function stateToListing(state: SubmissionState): ListingStatus | null {
  switch (state) {
    case 'draft':
      return null;
    case 'pending':
      return 'pending';
    case 'approved':
    case 'published':
      return 'approved';
    case 'rejected':
    case 'removed':
      return 'rejected';
    default:
      throw new RangeError(`state "${state}" has no stored listing form yet`);
  }
}

// ---------------------------------------------------------------------------
// Wrapper edges the diagram does not contain (kept on purpose)
// ---------------------------------------------------------------------------

/** Staff decisions as the Planner API names them. */
export type ModerationDecision = 'approve' | 'reject' | 'remove';

/**
 * Staff decision. Today `approve` means live, so it runs `approve` then
 * `publish` in one step (spec "Approve and publish"). `remove` takes a live
 * item down. `null` = not allowed from `state`.
 */
export function decide(state: SubmissionState, decision: ModerationDecision): SubmissionState | null {
  if (decision === 'approve') {
    const approved = transition(state, 'approve');
    return approved === null ? null : transition(approved, 'publish');
  }
  return transition(state, decision === 'reject' ? 'reject' : 'remove');
}

/**
 * Legacy edge (a): the owner's request is accepted from ANY state and always
 * lands in `pending`, overwriting a prior decision. Not a `transition` edge.
 */
export function legacyRequest(_from: SubmissionState): 'pending' {
  return 'pending';
}

/**
 * Legacy edge (b): withdrawing, or the implicit end of a listing (leaving
 * `public`, archiving the trip), works from ANY state, including none, and
 * ends in `draft` (stored `null`). Idempotent. Not a `transition` edge.
 */
export function legacyWithdraw(_from: SubmissionState): 'draft' {
  return 'draft';
}
