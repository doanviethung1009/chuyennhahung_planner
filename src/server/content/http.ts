import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeAdmin } from './auth';
import { ContentError, type FieldIssue } from './errors';
import { listQuerySchema } from './schemas';

export interface ApiErrorBody {
  error: { code: string; message: string; issues: FieldIssue[] };
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
      error: { code: error.code, message: error.message, issues: error.issues },
    };
    return NextResponse.json(body, { status: error.status, headers: NO_STORE });
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

/** Parses a JSON body against `schema`, turning malformed JSON into a 400. */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
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
  }
}
