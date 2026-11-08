import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ContentError } from '../src/server/content/errors';
import {
  MAX_JSON_BODY_BYTES,
  parseJsonBody,
  toErrorResponse,
} from '../src/server/content/http';

/**
 * `parseJsonBody` is the single door every mutating endpoint goes through —
 * both the Travel Content admin surface and the Planner, which imports it from
 * here. Nothing upstream bounds the request body, so if this function buffers
 * whatever arrives, one request can cost arbitrary memory.
 *
 * It also stands in front of `schema.parse`, and the pinned zod 3.x is subject
 * to GHSA-mrhx-c7xc-m3w5 (memory exhaustion while validating an oversized
 * constrained collection). Capping the bytes caps that too.
 */

const schema = z.object({ name: z.string() });
const url = 'https://example.test/api/admin/travel/places';

/** A POST whose body is a plain string, the ordinary case. */
function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

/**
 * A POST whose body arrives as a stream in `chunkCount` pieces, with no
 * trustworthy `Content-Length` — the shape a chunked upload takes.
 */
function postStream(chunk: string, chunkCount: number): Request {
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= chunkCount) {
        controller.close();
        return;
      }
      sent += 1;
      controller.enqueue(new TextEncoder().encode(chunk));
    },
  });

  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    // Required by undici when the body is a stream.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

/** The ContentError a call threw, or a failure if it resolved. */
async function errorFrom(promise: Promise<unknown>): Promise<ContentError> {
  try {
    await promise;
  } catch (error) {
    expect(error, 'expected a ContentError').toBeInstanceOf(ContentError);
    return error as ContentError;
  }
  throw new Error('expected parseJsonBody to reject, but it resolved');
}

describe('parseJsonBody', () => {
  describe('parses what it should', () => {
    it('accepts and validates an ordinary body', async () => {
      await expect(parseJsonBody(post('{"name":"Đà Lạt"}'), schema))
        .resolves.toEqual({ name: 'Đà Lạt' });
    });

    it('decodes multi-byte UTF-8 split across stream chunks', async () => {
      // "Đà" is two bytes per character; chunking must not corrupt it.
      const request = postStream('{"name":"Đà Lạt"}', 1);
      await expect(parseJsonBody(request, schema))
        .resolves.toEqual({ name: 'Đà Lạt' });
    });

    it('accepts a body exactly at the limit', async () => {
      const padding = 'x'.repeat(MAX_JSON_BODY_BYTES - '{"name":""}'.length);
      const body = `{"name":"${padding}"}`;
      expect(new TextEncoder().encode(body).byteLength).toBe(MAX_JSON_BODY_BYTES);
      await expect(parseJsonBody(post(body), schema)).resolves.toEqual({
        name: padding,
      });
    });
  });

  describe('refuses an oversized body', () => {
    it('rejects on a declared Content-Length over the limit', async () => {
      // The declared length is a free check, so it is made before reading.
      const request = post('{"name":"small"}', {
        'content-length': String(MAX_JSON_BODY_BYTES + 1),
      });
      const error = await errorFrom(parseJsonBody(request, schema));
      expect(error.code).toBe('payload_too_large');
      expect(error.status).toBe(413);
    });

    it('rejects a stream that goes over the limit without a Content-Length', async () => {
      // 64 KiB x 8 = 512 KiB, twice the cap, and the length is never declared.
      const request = postStream('x'.repeat(64 * 1024), 8);
      expect(request.headers.get('content-length')).toBeNull();

      const error = await errorFrom(parseJsonBody(request, schema));
      expect(error.code).toBe('payload_too_large');
      expect(error.status).toBe(413);
    });

    it('refuses an oversized body one byte past the limit', async () => {
      const body = `{"name":"${'x'.repeat(MAX_JSON_BODY_BYTES)}"}`;
      const error = await errorFrom(parseJsonBody(post(body), schema));
      expect(error.code).toBe('payload_too_large');
    });

    it('honours a lower per-call limit', async () => {
      const error = await errorFrom(parseJsonBody(post('{"name":"abc"}'), schema, 4));
      expect(error.code).toBe('payload_too_large');
      expect(error.message).toContain('4-byte limit');
    });

    it('refuses an oversized collection before zod can validate it', async () => {
      // The shape GHSA-mrhx-c7xc-m3w5 is about: a huge array aimed at a
      // constrained collection. It must never reach schema.parse.
      const listSchema = z.object({ tags: z.array(z.string()).max(20) });
      const body = JSON.stringify({ tags: Array(200_000).fill('tag') });
      expect(body.length).toBeGreaterThan(MAX_JSON_BODY_BYTES);

      const error = await errorFrom(parseJsonBody(post(body), listSchema));
      expect(error.code).toBe('payload_too_large');
    });
  });

  describe('keeps the existing error contract', () => {
    it('still reports malformed JSON as bad_request', async () => {
      const error = await errorFrom(parseJsonBody(post('{"name":'), schema));
      expect(error.code).toBe('bad_request');
      expect(error.status).toBe(400);
    });

    it('still lets a schema failure through as a ZodError', async () => {
      // 422 mapping lives in toErrorResponse and must not become a 400 here.
      await expect(parseJsonBody(post('{"name":42}'), schema))
        .rejects.toBeInstanceOf(z.ZodError);
    });

    it('treats an empty body as malformed, not as too large', async () => {
      const error = await errorFrom(parseJsonBody(post(''), schema));
      expect(error.code).toBe('bad_request');
    });
  });

  describe('maps to a response', () => {
    it('answers 413 with the payload_too_large code', async () => {
      const request = post('{}', {
        'content-length': String(MAX_JSON_BODY_BYTES + 1),
      });
      const error = await errorFrom(parseJsonBody(request, schema));

      const response = toErrorResponse(error);
      expect(response.status).toBe(413);
      expect(response.headers.get('cache-control')).toBe('no-store');

      const body = (await response.json()) as {
        error: { code: string; message: string; issues: unknown[] };
      };
      expect(body.error.code).toBe('payload_too_large');
      expect(body.error.issues).toEqual([]);
    });
  });
});
