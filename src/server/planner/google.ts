import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from 'node:crypto';

/**
 * Google sign-in: a hand-written OpenID Connect authorization-code flow with
 * PKCE (ADR 0007). `fetch` and `node:crypto` only — no dependency.
 *
 * Everything that talks to Google takes a `fetchImpl` so tests can stand in a
 * fake Google; the routes pass nothing and get the global `fetch`.
 */

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** The callback path. Not localized: it is an API route Google redirects to. */
export const GOOGLE_CALLBACK_PATH = '/api/planner/oauth/google/callback';

/** The cookie that binds an in-flight attempt to this browser. */
export const OAUTH_STATE_COOKIE = 'planner_oauth_state';
export const OAUTH_COOKIE_PATH = '/api/planner/oauth';

/** Tolerated clock difference with Google when checking `exp` / `iat`. */
const CLOCK_SKEW_SECONDS = 60;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** False closes self-service signup: unmatched sign-ins are refused. */
  signupEnabled: boolean;
  /** Explicit override; otherwise derived per request. */
  redirectUri: string | null;
}

type Env = Record<string, string | undefined>;

/**
 * Null when Google is not configured — and then both Google routes answer 404
 * and the sign-in page hides the button (fail closed). Server-only: these
 * values are never `NEXT_PUBLIC_*` and never reach a client module.
 */
export function googleConfig(env: Env = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    signupEnabled: env.GOOGLE_SIGNUP_ENABLED?.trim().toLowerCase() !== 'false',
    redirectUri: env.GOOGLE_REDIRECT_URI?.trim() || null,
  };
}

/**
 * The redirect URI must be byte-identical in the authorize request, the token
 * exchange and Google Cloud Console. Order: explicit override, then the
 * public site URL, then the request's own origin (local development).
 */
export function googleRedirectUri(config: GoogleConfig, request: Request, env: Env = process.env): string {
  if (config.redirectUri) return config.redirectUri;
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = site ? new URL(site).origin : new URL(request.url).origin;
  return `${base}${GOOGLE_CALLBACK_PATH}`;
}

export interface OAuthSecrets {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export function newOAuthSecrets(): OAuthSecrets {
  return {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    // 32 bytes → 43 base64url characters, the RFC 7636 minimum length.
    codeVerifier: randomBytes(32).toString('base64url'),
  };
}

export function hashState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export function pkceChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
}

export function googleAuthorizeUrl(
  config: GoogleConfig,
  redirectUri: string,
  secrets: OAuthSecrets,
): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: secrets.state,
    nonce: secrets.nonce,
    code_challenge: pkceChallenge(secrets.codeVerifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

/**
 * A Google sign-in that did not succeed. `code` is coarse on purpose — it is
 * what the sign-in page shows; the detail is for the server log only.
 */
export class GoogleSignInError extends Error {
  constructor(
    readonly code: 'google_failed' | 'google_unverified',
    detail: string,
  ) {
    super(detail);
    this.name = 'GoogleSignInError';
  }
}

const fail = (detail: string) => new GoogleSignInError('google_failed', detail);

/** The claims this app uses, after every check has passed. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}

type FetchImpl = typeof fetch;

/** Server-to-server code exchange. Returns the raw `id_token`. */
export async function exchangeGoogleCode(
  config: GoogleConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
      cache: 'no-store',
    });
  } catch (error) {
    throw fail(`token endpoint unreachable: ${String(error)}`);
  }
  if (!response.ok) throw fail(`token endpoint answered ${response.status}`);
  const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!body || typeof body.id_token !== 'string') throw fail('token response has no id_token');
  return body.id_token;
}

// ---------------------------------------------------------------------------
// JWKS
// ---------------------------------------------------------------------------

interface CachedKeys {
  keys: Map<string, JsonWebKey>;
  expiresAt: number;
}

let keyCache: CachedKeys | null = null;

/** Tests only: forget Google's keys so the next call refetches. */
export function resetGoogleKeyCache(): void {
  keyCache = null;
}

function maxAgeSeconds(cacheControl: string | null): number {
  const match = cacheControl?.match(/max-age=(\d+)/);
  const seconds = match ? Number(match[1]) : 0;
  // Bounded both ways: always cache a little, never trust a key for a day.
  return Math.min(Math.max(seconds, 60), 6 * 60 * 60);
}

async function fetchKeys(fetchImpl: FetchImpl, now: number): Promise<CachedKeys> {
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_JWKS_URL, { cache: 'no-store' });
  } catch (error) {
    throw fail(`JWKS unreachable: ${String(error)}`);
  }
  if (!response.ok) throw fail(`JWKS answered ${response.status}`);
  const body = (await response.json().catch(() => null)) as { keys?: unknown } | null;
  if (!body || !Array.isArray(body.keys)) throw fail('JWKS has no keys');

  const keys = new Map<string, JsonWebKey>();
  for (const key of body.keys as JsonWebKey[]) {
    if (typeof key.kid === 'string' && key.kty === 'RSA') keys.set(key.kid, key);
  }
  return { keys, expiresAt: now + maxAgeSeconds(response.headers.get('cache-control')) * 1000 };
}

/** Cached per `Cache-Control`; refetched once when a `kid` is unknown (rotation). */
async function googleKey(kid: string, fetchImpl: FetchImpl, now: number): Promise<JsonWebKey> {
  if (!keyCache || keyCache.expiresAt <= now) keyCache = await fetchKeys(fetchImpl, now);
  let key = keyCache.keys.get(kid);
  if (!key) {
    keyCache = await fetchKeys(fetchImpl, now);
    key = keyCache.keys.get(kid);
  }
  if (!key) throw fail(`no Google key with kid "${kid}"`);
  return key;
}

// ---------------------------------------------------------------------------
// id_token verification
// ---------------------------------------------------------------------------

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw fail('id_token segment is not a JSON object');
}

/**
 * Verifies an `id_token` completely: RS256 signature against Google's keys,
 * `iss`, `aud`, `exp`, `iat`, `nonce`, and `email_verified`. Any failure throws;
 * nothing partial is ever returned.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: { clientId: string; nonce: string; now?: Date; fetchImpl?: FetchImpl },
): Promise<GoogleIdentity> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowMs = (options.now ?? new Date()).getTime();
  const nowSeconds = Math.floor(nowMs / 1000);

  const parts = idToken.split('.');
  if (parts.length !== 3) throw fail('id_token is not a compact JWS');
  const [headerPart = '', payloadPart = '', signaturePart = ''] = parts;

  const header = decodeSegment(headerPart);
  if (header.alg !== 'RS256') throw fail(`unexpected alg "${String(header.alg)}"`);
  if (typeof header.kid !== 'string') throw fail('id_token header has no kid');

  const jwk = await googleKey(header.kid, fetchImpl, nowMs);
  let valid = false;
  try {
    valid = verify(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`, 'ascii'),
      createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(signaturePart, 'base64url'),
    );
  } catch (error) {
    throw fail(`signature check failed: ${String(error)}`);
  }
  if (!valid) throw fail('bad id_token signature');

  const claims = decodeSegment(payloadPart);
  if (typeof claims.iss !== 'string' || !GOOGLE_ISSUERS.has(claims.iss)) throw fail('wrong iss');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.clientId)) throw fail('wrong aud');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS <= nowSeconds) {
    throw fail('id_token expired');
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw fail('id_token issued in the future');
  }
  if (claims.nonce !== options.nonce) throw fail('nonce mismatch');
  if (typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 255) {
    throw fail('id_token has no sub');
  }
  if (typeof claims.email !== 'string' || claims.email.length === 0) {
    throw new GoogleSignInError('google_unverified', 'id_token has no email');
  }
  if (claims.email_verified !== true) {
    throw new GoogleSignInError('google_unverified', 'email is not verified by Google');
  }

  const name = typeof claims.name === 'string' ? claims.name.trim() : '';
  return {
    sub: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: name.length > 0 ? name : null,
  };
}
