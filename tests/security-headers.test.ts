import { describe, expect, it } from 'vitest';
import nextConfig, { securityHeaders, sharePaths } from '../next.config';
import { pathnames } from '../src/i18n/routing';

const byName = new Map(securityHeaders.map((h) => [h.key.toLowerCase(), h.value]));

describe('site-wide security headers', () => {
  it('applies to every path', async () => {
    const rules = await nextConfig.headers?.();
    expect(rules?.[0]).toEqual({ source: '/:path*', headers: securityHeaders });
  });

  it('restates no-referrer, last, on every path that carries a share token', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const shareRoute = pathnames['/shared/[token]'];
    expect(sharePaths).toEqual([
      '/api/shared/:path*',
      `${shareRoute.vi.replace('/[token]', '')}/:path*`,
      `/en${shareRoute.en.replace('/[token]', '')}/:path*`,
    ]);
    for (const source of sharePaths) {
      const last = rules.filter((r) => r.source === source || r.source === '/:path*').at(-1);
      expect(last).toEqual({ source, headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] });
    }
  });

  it('forbids framing, MIME sniffing and unused device APIs', () => {
    expect(byName.get('x-frame-options')).toBe('DENY');
    expect(byName.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(byName.get('content-security-policy')).toContain("object-src 'none'");
    expect(byName.get('x-content-type-options')).toBe('nosniff');
    expect(byName.get('permissions-policy')).toContain('camera=()');
    expect(byName.get('strict-transport-security')).toMatch(/max-age=\d+/);
  });

  it('sends no script-src, which would need nonces (see next.config.ts)', () => {
    expect(byName.get('content-security-policy')).not.toMatch(/script-src|default-src/);
  });

  it('keeps a referrer policy that leaks no path cross-origin', () => {
    // The share surfaces override this with no-referrer (test above).
    expect(byName.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});
