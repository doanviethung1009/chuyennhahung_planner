import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authorizeAdmin } from '../src/server/content/auth';

const VALID = 'a'.repeat(40);

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api/admin/travel/places', { headers });
}

function expectRefusal(call: () => unknown, code: string): void {
  try {
    call();
  } catch (error) {
    expect((error as { code: string }).code).toBe(code);
    return;
  }
  throw new Error(`expected a refusal with code "${code}" but the call succeeded`);
}

const originalToken = process.env.ADMIN_API_TOKEN;

beforeEach(() => {
  delete process.env.ADMIN_API_TOKEN;
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.ADMIN_API_TOKEN;
  else process.env.ADMIN_API_TOKEN = originalToken;
});

describe('admin authorization fails closed', () => {
  it('refuses every request when no token is configured', () => {
    expectRefusal(
      () => authorizeAdmin(request({ authorization: `Bearer ${VALID}` })),
      'admin_auth_unconfigured',
    );
  });

  it('treats a short token as a misconfiguration, not a weak secret', () => {
    process.env.ADMIN_API_TOKEN = 'dev';
    expectRefusal(
      () => authorizeAdmin(request({ authorization: 'Bearer dev' })),
      'admin_auth_unconfigured',
    );
  });

  it('treats a blank token as unconfigured', () => {
    process.env.ADMIN_API_TOKEN = '   ';
    expectRefusal(() => authorizeAdmin(request()), 'admin_auth_unconfigured');
  });
});

describe('admin authorization with a configured token', () => {
  beforeEach(() => {
    process.env.ADMIN_API_TOKEN = VALID;
  });

  it('accepts the correct bearer token', () => {
    expect(authorizeAdmin(request({ authorization: `Bearer ${VALID}` }))).toEqual({
      principal: 'admin-token',
    });
  });

  it('accepts a case-insensitive scheme', () => {
    expect(
      authorizeAdmin(request({ authorization: `bearer ${VALID}` })).principal,
    ).toBe('admin-token');
  });

  it('refuses a missing header', () => {
    expectRefusal(() => authorizeAdmin(request()), 'unauthorized');
  });

  it('refuses a wrong token of the same length', () => {
    expectRefusal(
      () => authorizeAdmin(request({ authorization: `Bearer ${'b'.repeat(40)}` })),
      'unauthorized',
    );
  });

  it('refuses a token that is a prefix of the real one', () => {
    expectRefusal(
      () => authorizeAdmin(request({ authorization: `Bearer ${'a'.repeat(39)}` })),
      'unauthorized',
    );
  });

  it('refuses a token with the real one as a prefix', () => {
    expectRefusal(
      () => authorizeAdmin(request({ authorization: `Bearer ${'a'.repeat(41)}` })),
      'unauthorized',
    );
  });

  it.each(['Basic', 'Token', 'Bearer2'])('refuses the "%s" scheme', (scheme) => {
    expectRefusal(
      () => authorizeAdmin(request({ authorization: `${scheme} ${VALID}` })),
      'unauthorized',
    );
  });

  it('refuses a bare token with no scheme', () => {
    expectRefusal(() => authorizeAdmin(request({ authorization: VALID })), 'unauthorized');
  });

  it('refuses an empty bearer value', () => {
    expectRefusal(() => authorizeAdmin(request({ authorization: 'Bearer ' })), 'unauthorized');
  });
});
