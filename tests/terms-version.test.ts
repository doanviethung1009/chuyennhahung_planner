import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contribution, termsVersion } from '../src/content/site';

/**
 * The Creator Terms text and its version move together (ADR 0019 §4, D5).
 * To change the text: edit `contribution.terms`, bump `termsVersion` in
 * `src/content/site.ts`, then paste the new pair below (the failure message
 * prints the hash). Bumping the version asks every member to accept again.
 */
const PINNED = { version: '2026-11-18', sha256: 'd552c7cff9fd66d504bf1ea301a5a190034600769e446b761ff8d8e2534bb7f2' };

const fingerprint = () =>
  createHash('sha256').update(`${contribution.terms?.vi ?? ''}\n---\n${contribution.terms?.en ?? ''}`).digest('hex');

describe('Creator Terms version', () => {
  it('is a non-empty identifier', () => {
    expect(termsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('changes whenever the text changes', () => {
    const actual = fingerprint();
    if (termsVersion === PINNED.version) {
      expect(actual, `terms text changed but termsVersion is still ${termsVersion}: bump it, then update PINNED (new hash ${actual})`).toBe(PINNED.sha256);
    } else {
      expect(actual, `termsVersion moved to ${termsVersion}: update PINNED to { version: '${termsVersion}', sha256: '${actual}' }`).toBe(PINNED.sha256);
    }
  });
});
