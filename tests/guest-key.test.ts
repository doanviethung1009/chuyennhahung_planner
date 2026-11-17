import { describe, expect, it } from 'vitest';
import { isContentError } from '../src/server/content/repository';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import {
  GUEST_KEY_SECRET_ENV,
  guestKeyOf,
  limiterKeyOf,
  readGuestKeySecret,
} from '../src/server/community/guest-key';
import { randomUUID } from 'node:crypto';
import { PlannerRepository } from '../src/server/planner/repository';
import { fakeCatalog } from './planner-helpers';
import { registerGuestKeyCases } from './guest-key-cases';

const A = 'secret-a-0123456789abcdef0123456789abcdef';
const B = 'secret-b-0123456789abcdef0123456789abcdef';

describe('guest key helper (ADR 0024)', () => {
  it('is deterministic, 32 hex characters, and depends on the secret and the client', () => {
    expect(guestKeyOf(A, '203.0.113.5')).toMatch(/^[0-9a-f]{32}$/);
    expect(guestKeyOf(A, '203.0.113.5')).toBe(guestKeyOf(A, '203.0.113.5'));
    expect(guestKeyOf(A, '203.0.113.5')).not.toBe(guestKeyOf(B, '203.0.113.5'));
    expect(guestKeyOf(A, '203.0.113.5')).not.toBe(guestKeyOf(A, '203.0.113.6'));
  });

  it('keeps guest keys and limiter keys apart even for the same input', () => {
    expect(limiterKeyOf(A, 'guest-review', 'x')).toMatch(/^[0-9a-f]{64}$/);
    expect(limiterKeyOf(A, 'guest-review', 'x').startsWith(guestKeyOf(A, 'x'))).toBe(false);
    expect(limiterKeyOf(A, 'a', 'k')).not.toBe(limiterKeyOf(A, 'b', 'k'));
    expect(limiterKeyOf(A, 'a', 'k')).not.toBe(limiterKeyOf(B, 'a', 'k'));
  });

  it('reads the secret from the environment, and fails closed when it is missing or short', () => {
    expect(readGuestKeySecret({ [GUEST_KEY_SECRET_ENV]: ` ${A} ` })).toBe(A);
    for (const env of [{}, { [GUEST_KEY_SECRET_ENV]: '' }, { [GUEST_KEY_SECRET_ENV]: 'tiny-value-9' }]) {
      try {
        readGuestKeySecret(env);
        throw new Error('expected a failure');
      } catch (error) {
        expect(isContentError(error) && error.code).toBe('service_unavailable');
        // The message names the variable, never a value.
        expect((error as Error).message).not.toContain('tiny-value-9');
      }
    }
  });
});

describe('guest keys on the memory store (batch 10.6b)', () => {
  registerGuestKeyCases(async () => {
    const store = createMemoryPlannerStore();
    return {
      store,
      make: ({ now, secret }) => {
        let n = 0;
        return new PlannerRepository({
          store,
          catalog: fakeCatalog(),
          now,
          scryptCostLog2: 10,
          guestKeySecret: secret,
          newId: (prefix) => `${prefix}_${(n += 1)}_${randomUUID().slice(0, 4)}`,
        });
      },
    };
  });
});
