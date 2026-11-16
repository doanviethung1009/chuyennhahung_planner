import { describe, expect, it } from 'vitest';
import { PUBLIC_USER_FIELDS } from '../src/server/planner/repository';
import { plannerUserSchema } from '../src/server/planner/schemas';

const CREDENTIAL_FIELDS = ['tokenHash', 'passwordHash', 'googleSub'];

describe('toPublicUser allowlist', () => {
  it('names every non-credential field of the user schema, and no credential', () => {
    const expected = Object.keys(plannerUserSchema.shape)
      .filter((key) => !CREDENTIAL_FIELDS.includes(key) && key !== 'role')
      .sort();
    // A field added to the schema must be named in PUBLIC_USER_FIELDS on
    // purpose (or listed as a credential above); this fails until it is.
    expect([...PUBLIC_USER_FIELDS].sort()).toEqual(expected);
    for (const field of CREDENTIAL_FIELDS) expect(PUBLIC_USER_FIELDS).not.toContain(field);
  });
});
