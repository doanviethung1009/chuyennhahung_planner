import { describe, expect, it } from 'vitest';
import {
  decide,
  legacyRequest,
  legacyWithdraw,
  listingToState,
  stateToListing,
  transition,
  type SubmissionAction,
  type SubmissionState,
} from '@/server/community/submission';

const STATES: SubmissionState[] = [
  'draft', 'pending', 'changes_requested', 'approved', 'published',
  'rejected', 'unpublished', 'removed', 'archived',
];
const ACTIONS: SubmissionAction[] = [
  'submit', 'approve', 'reject', 'request_changes', 'resubmit', 'publish', 'unpublish',
  'edit_material', 'remove', 'rework', 'archive', 'restore', 'admin_restore',
];

// Every edge of the diagram in docs/specs-community-moderation.md.
const EDGES: [SubmissionState, SubmissionAction, SubmissionState][] = [
  ['draft', 'submit', 'pending'],
  ['pending', 'approve', 'approved'],
  ['pending', 'reject', 'rejected'],
  ['pending', 'request_changes', 'changes_requested'],
  ['changes_requested', 'resubmit', 'pending'],
  ['approved', 'publish', 'published'],
  ['published', 'unpublish', 'unpublished'],
  ['published', 'edit_material', 'pending'],
  ['published', 'remove', 'removed'],
  ['rejected', 'rework', 'draft'],
  ['unpublished', 'rework', 'draft'],
  ['draft', 'archive', 'archived'],
  ['unpublished', 'archive', 'archived'],
  ['archived', 'restore', 'draft'],
  ['removed', 'admin_restore', 'unpublished'],
];

describe('transition', () => {
  it.each(EDGES)('%s --%s--> %s', (from, action, to) => {
    expect(transition(from, action)).toBe(to);
  });

  it('forbids every pair that is not a diagram edge', () => {
    const allowed = new Set(EDGES.map(([f, a]) => `${f}|${a}`));
    let checked = 0;
    for (const s of STATES) {
      for (const a of ACTIONS) {
        if (allowed.has(`${s}|${a}`)) continue;
        expect(transition(s, a), `${s} --${a}-->`).toBeNull();
        checked += 1;
      }
    }
    expect(checked).toBe(STATES.length * ACTIONS.length - EDGES.length);
  });

  it('keeps the odd cases forbidden', () => {
    expect(transition('removed', 'publish')).toBeNull();
    expect(transition('removed', 'submit')).toBeNull();
    expect(transition('archived', 'submit')).toBeNull();
    expect(transition('rejected', 'approve')).toBeNull();
    expect(transition('pending', 'remove')).toBeNull();
  });
});

describe('listing mapping', () => {
  it('maps stored values to states and back', () => {
    expect(listingToState(null)).toBe('draft');
    expect(listingToState('pending')).toBe('pending');
    expect(listingToState('approved')).toBe('published');
    expect(listingToState('rejected')).toBe('rejected');
    for (const stored of [null, 'pending', 'approved', 'rejected'] as const) {
      expect(stateToListing(listingToState(stored))).toBe(stored);
    }
  });

  it('stores approved, published as approved and removed as rejected (legacy c)', () => {
    expect(stateToListing('approved')).toBe('approved');
    expect(stateToListing('published')).toBe('approved');
    expect(stateToListing('removed')).toBe('rejected');
  });

  it('refuses states with no stored form yet', () => {
    for (const s of ['changes_requested', 'unpublished', 'archived'] as const) {
      expect(() => stateToListing(s)).toThrow(RangeError);
    }
  });
});

describe('legacy wrapper edges', () => {
  it('(a) a request lands in pending from every state', () => {
    for (const s of STATES) expect(legacyRequest(s)).toBe('pending');
  });

  it('(b) withdraw ends in draft (no listing) from every state', () => {
    for (const s of STATES) {
      expect(legacyWithdraw(s)).toBe('draft');
      expect(stateToListing(legacyWithdraw(s))).toBeNull();
    }
  });

  it('(c) staff remove of a live listing is stored as rejected', () => {
    const next = decide(listingToState('approved'), 'remove');
    expect(next).toBe('removed');
    expect(stateToListing(next as SubmissionState)).toBe('rejected');
  });

  it('decide: approve goes live in one step, only from pending', () => {
    expect(decide('pending', 'approve')).toBe('published');
    expect(stateToListing('published')).toBe('approved');
    expect(decide('published', 'approve')).toBeNull();
    expect(decide('rejected', 'approve')).toBeNull();
    expect(decide('draft', 'approve')).toBeNull();
  });

  it('decide: reject only from pending, remove only from live', () => {
    expect(decide('pending', 'reject')).toBe('rejected');
    expect(decide('published', 'reject')).toBeNull();
    expect(decide('pending', 'remove')).toBeNull();
    expect(decide('rejected', 'remove')).toBeNull();
  });
});
