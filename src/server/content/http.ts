import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeAdmin } from './auth';
import { invalidateOverviewCacheAfter } from '@/server/overview-cache';
import { ContentError, payloadTooLarge, type FieldIssue } from './errors';
import { listQuerySchema } from './schemas';

export interface ApiErrorBody {
  error: { code: string; message: string; issues: FieldIssue[]; reason?: string; details?: Record<string, unknown> };
}

/**
 * Content endpoints are read-your-own-writes by nature, so nothing here is
 * cacheable at the edge. Admin responses additionally must never be stored.
 */
const NO_STORE = { 'cache-control': 'no-store' } as const;

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonCreated<T>(data: T): NextResponse {
  return jsonOk(data, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

function issuesFromZod(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Maps any thrown value to a response. Unknown errors become a 500 with a
 * generic message — internal detail is logged, never returned.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ContentError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        issues: error.issues,
        ...(error.reason ? { reason: error.reason } : {}),
        ...(error.details ? { details: error.details } : {}),
      },
    };
    const headers: Record<string, string> = { ...NO_STORE };
    if (error.retryAfterSeconds !== null) {
      headers['retry-after'] = String(error.retryAfterSeconds);
    }
    return NextResponse.json(body, { status: error.status, headers });
  }

  if (error instanceof z.ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'validation_failed',
        message: 'the request body failed validation',
        issues: issuesFromZod(error),
      },
    };
    return NextResponse.json(body, { status: 422, headers: NO_STORE });
  }

  console.error('[travel-content] unhandled error', error);
  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'internal error', issues: [] },
  };
  return NextResponse.json(body, { status: 500, headers: NO_STORE });
}

/**
 * The largest request body any endpoint here will read.
 *
 * Every legitimate payload is a single record — the entire seed file is under
 * 30 KB — so this leaves roughly a tenfold margin while still bounding how much
 * memory one request can cost. It is deliberately enforced *before* parsing:
 * `request.json()` buffers the whole body first, so a cap applied afterwards
 * would be a cap on nothing.
 */
export const MAX_JSON_BODY_BYTES = 256 * 1024;

/**
 * Reads the body as text, refusing to buffer more than `maxBytes`.
 *
 * `Content-Length` is checked first because it is free, but it is only a claim:
 * it can be absent on a chunked request and it can lie. So the stream is also
 * measured as it arrives and cancelled the moment it goes over, which is what
 * actually bounds the cost.
 */
async function readBodyText(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw payloadTooLarge(maxBytes);
  }

  const body = request.body;
  // No stream to measure (an empty body, or a runtime that does not expose
  // one): fall back to the buffered read, having checked the declared length.
  if (!body) return request.text();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) throw payloadTooLarge(maxBytes);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(joined);
}

/**
 * Parses a JSON body against `schema`, turning malformed JSON into a 400 and an
 * oversized body into a 413.
 *
 * The size limit is not only a denial-of-service guard in the abstract: the
 * pinned `zod` 3.x is subject to GHSA-mrhx-c7xc-m3w5, where validating an
 * oversized constrained collection can exhaust memory. Bounding the bytes that
 * reach `schema.parse` bounds that too, and it keeps holding once zod is
 * upgraded.
 */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<z.infer<S>> {
  const text = await readBodyText(request, maxBytes);

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new ContentError('bad_request', 'request body is not valid JSON');
  }
  return schema.parse(raw) as z.infer<S>;
}

/**
 * Like `parseJsonBody`, but an empty body is a valid request and parses as `{}`.
 * For endpoints whose every field is optional, so a client can send a bare POST
 * without inventing a `{}`. The size limit and the schema still apply.
 */
export async function parseOptionalJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<z.infer<S>> {
  const text = await readBodyText(request, maxBytes);
  if (text.trim() === '') return schema.parse({}) as z.infer<S>;

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new ContentError('bad_request', 'request body is not valid JSON');
  }
  return schema.parse(raw) as z.infer<S>;
}

export function parseListQuery(request: Request): z.infer<typeof listQuerySchema> {
  const params = new URL(request.url).searchParams;
  const raw: Record<string, string> = {};
  for (const key of [
    'status',
    'destinationSlug',
    'category',
    'travelStyle',
    'visibility',
    'q',
    'limit',
    'offset',
  ]) {
    const value = params.get(key);
    if (value !== null && value !== '') raw[key] = value;
  }
  return listQuerySchema.parse(raw);
}

type Handler = () => Promise<NextResponse> | NextResponse;

/** Wraps a public read handler with uniform error mapping. */
export async function publicRoute(handler: Handler): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Wraps an admin handler: authorize first, then run, then map errors. Every
 * admin mutation in this system goes through here — authorization is not
 * something an individual route can forget to do.
 */
export async function adminRoute(
  request: Request,
  handler: Handler,
): Promise<NextResponse> {
  try {
    authorizeAdmin(request);
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  } finally {
    invalidateOverviewCacheAfter(request);
  }
}
