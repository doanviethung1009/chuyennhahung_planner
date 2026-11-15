import { describe, expect, it } from 'vitest';
import { GET as health } from '@/app/api/health/route';
import { isSecureRequest, ownOrigins, trustsProxyHeaders } from '@/server/request-scheme';

const proxied = (proto?: string) =>
  new Request('http://app:3000/api/planner/session', {
    headers: proto ? { 'x-forwarded-proto': proto } : {},
  });

describe('isSecureRequest', () => {
  it('follows the request scheme when there is no proxy', () => {
    expect(isSecureRequest(new Request('https://chuyennhahung.vn/'), {})).toBe(true);
    expect(isSecureRequest(new Request('http://localhost:3000/'), {})).toBe(false);
  });

  it('ignores X-Forwarded-Proto unless TRUST_PROXY_HEADERS is true', () => {
    expect(isSecureRequest(proxied('https'), {})).toBe(false);
    expect(isSecureRequest(proxied('https'), { TRUST_PROXY_HEADERS: 'false' })).toBe(false);
    expect(isSecureRequest(proxied('https'), { TRUST_PROXY_HEADERS: '1' })).toBe(false);
  });

  it('trusts the first X-Forwarded-Proto value behind a declared proxy', () => {
    const env = { TRUST_PROXY_HEADERS: 'true' };
    expect(isSecureRequest(proxied('https'), env)).toBe(true);
    expect(isSecureRequest(proxied('HTTPS, http'), env)).toBe(true);
    expect(isSecureRequest(proxied('http'), env)).toBe(false);
    expect(isSecureRequest(proxied('http, https'), env)).toBe(false);
    expect(isSecureRequest(proxied(), env)).toBe(false);
  });

  it('reads the flag strictly', () => {
    expect(trustsProxyHeaders({ TRUST_PROXY_HEADERS: ' TRUE ' })).toBe(true);
    expect(trustsProxyHeaders({ TRUST_PROXY_HEADERS: 'yes' })).toBe(false);
    expect(trustsProxyHeaders({})).toBe(false);
  });
});

describe('ownOrigins', () => {
  // Behind a proxy Next reports the bind address, not the public host.
  const behindProxy = new Request('https://0.0.0.0:3000/api/planner/session');

  it('adds the public site origin to the request origin', () => {
    const origins = ownOrigins(behindProxy, { NEXT_PUBLIC_SITE_URL: 'https://chuyennhahung.vn/' });
    expect(origins.has('https://chuyennhahung.vn')).toBe(true);
    expect(origins.has('https://0.0.0.0:3000')).toBe(true);
    expect(origins.has('https://evil.example')).toBe(false);
    expect(origins.has('http://chuyennhahung.vn')).toBe(false);
  });

  it('falls back to the request origin when the site URL is absent or malformed', () => {
    expect([...ownOrigins(behindProxy, {})]).toEqual(['https://0.0.0.0:3000']);
    expect([...ownOrigins(behindProxy, { NEXT_PUBLIC_SITE_URL: 'not a url' })]).toEqual([
      'https://0.0.0.0:3000',
    ]);
  });
});

describe('ownOrigins behind a trusted proxy', () => {
  const env = { TRUST_PROXY_HEADERS: 'true', NEXT_PUBLIC_SITE_URL: 'http://192-168-100-140.nip.io' };
  const via = (host: string, proto = 'http') =>
    new Request('http://0.0.0.0:3000/api/planner/session', {
      headers: { 'x-forwarded-host': host, 'x-forwarded-proto': proto },
    });

  it('accepts the host the browser used, alongside the site URL', () => {
    const byIp = ownOrigins(via('192.168.100.140'), env);
    expect(byIp.has('http://192.168.100.140')).toBe(true);
    expect(byIp.has('http://192-168-100-140.nip.io')).toBe(true);
    expect(ownOrigins(via('192-168-100-140.nip.io'), env).has('http://192-168-100-140.nip.io')).toBe(true);
    expect(ownOrigins(via('Example.COM:8080', 'https'), env).has('https://example.com:8080')).toBe(true);
  });

  it('ignores the headers unless TRUST_PROXY_HEADERS is true', () => {
    const origins = ownOrigins(via('192.168.100.140'), { NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL });
    expect(origins.has('http://192.168.100.140')).toBe(false);
  });

  it('refuses a malformed host or scheme', () => {
    for (const host of ['evil.example/path', 'a@evil.example', 'evil.example?x=1', '']) {
      expect(ownOrigins(via(host), env).size).toBe(2);
    }
    expect(ownOrigins(via('192.168.100.140', 'ftp'), env).size).toBe(2);
  });

  it('does not admit a different origin', () => {
    expect(ownOrigins(via('192.168.100.140'), env).has('http://evil.example')).toBe(false);
  });
});

describe('GET /api/health', () => {
  it('answers 200 without touching a store, uncached', async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
