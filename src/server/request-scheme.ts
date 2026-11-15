/**
 * Whether the browser reached us over HTTPS, which is what decides the
 * `Secure` attribute on the session and OAuth state cookies.
 *
 * On a plain dev server the request's own scheme is the answer. Behind a
 * TLS-terminating reverse proxy (the self-hosted nginx in `docs/usage.md` →
 * Deploy) the app only ever sees `http://`, and the browser's scheme arrives in
 * `X-Forwarded-Proto`. That header is set by whoever opened the connection, so
 * it is believed only when the operator says a proxy that overwrites it sits in
 * front: `TRUST_PROXY_HEADERS=true`.
 *
 * Note that Next's own Node server (16.x, `next start` and the standalone
 * `server.js`) already builds `request.url` with the scheme from
 * `X-Forwarded-Proto`, unconditionally — so behind such a server the first
 * branch below usually answers. The flag makes the behaviour explicit and keeps
 * it correct if that construction changes; the real defence is the proxy
 * overwriting the header (`proxy_set_header X-Forwarded-Proto $scheme`). A
 * client that spoofs it can only change the `Secure` flag on its own cookie.
 */

type Env = Record<string, string | undefined>;

export function trustsProxyHeaders(env: Env = process.env): boolean {
  return env.TRUST_PROXY_HEADERS?.trim().toLowerCase() === 'true';
}

export function isSecureRequest(request: Request, env: Env = process.env): boolean {
  if (new URL(request.url).protocol === 'https:') return true;
  if (!trustsProxyHeaders(env)) return false;
  // A proxy chain may append; the first value is the one the client used.
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  return forwarded === 'https';
}

/**
 * The origins a same-origin request may state. Behind a proxy, `request.url`
 * carries the address the server is bound to (`https://0.0.0.0:3000`), not the
 * one the browser used, so the public site URL — which is our origin by
 * definition, and is configuration rather than request input — counts too.
 *
 * `NEXT_PUBLIC_SITE_URL` is one address, fixed at build time. A site reachable
 * by two (an IP and a name) would refuse sign-in on the other one, so behind a
 * declared proxy (`TRUST_PROXY_HEADERS=true`) the host the browser used —
 * `X-Forwarded-Host` with `X-Forwarded-Proto`, both overwritten by the proxy —
 * counts as well. A cross-site page cannot choose either header on the
 * victim's request, so this never admits an attacker's origin.
 */
export function ownOrigins(request: Request, env: Env = process.env): Set<string> {
  const origins = new Set([new URL(request.url).origin]);
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      origins.add(new URL(site).origin);
    } catch {
      // A malformed site URL adds nothing; the request's own origin still holds.
    }
  }
  const forwarded = forwardedOrigin(request, env);
  if (forwarded) origins.add(forwarded);
  return origins;
}

/** `proto://host` the browser used, from the proxy's headers; null if absent or malformed. */
function forwardedOrigin(request: Request, env: Env): string | null {
  if (!trustsProxyHeaders(env)) return null;
  const first = (name: string) => request.headers.get(name)?.split(',')[0]?.trim().toLowerCase();
  const host = first('x-forwarded-host');
  const proto = first('x-forwarded-proto');
  if (!host || (proto !== 'http' && proto !== 'https')) return null;
  try {
    const url = new URL(`${proto}://${host}`);
    // A host with a path, userinfo or query is not a bare host: refuse it.
    return url.host === host ? url.origin : null;
  } catch {
    return null;
  }
}
