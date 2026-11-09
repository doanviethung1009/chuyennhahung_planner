/**
 * Domain errors carry a stable machine code and the HTTP status the API layer
 * should map them to, so a route handler never has to guess a status from a
 * message. Codes are developer-facing contract — they are not UI strings and
 * are deliberately not localized (CLAUDE.md rule 1 governs user-visible copy).
 */
export type ContentErrorCode =
  | 'bad_request'
  | 'payload_too_large'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'admin_auth_unconfigured'
  | 'not_found'
  | 'slug_conflict'
  | 'invalid_reference'
  | 'invalid_state'
  | 'precondition_required'
  | 'version_conflict';

const STATUS_BY_CODE: Record<ContentErrorCode, number> = {
  bad_request: 400,
  payload_too_large: 413,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  admin_auth_unconfigured: 503,
  not_found: 404,
  slug_conflict: 409,
  invalid_reference: 422,
  invalid_state: 409,
  precondition_required: 428,
  version_conflict: 412,
};

export interface FieldIssue {
  path: string;
  message: string;
}

export class ContentError extends Error {
  readonly code: ContentErrorCode;
  readonly status: number;
  readonly issues: FieldIssue[];

  constructor(code: ContentErrorCode, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ContentError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.issues = issues;
  }
}

/**
 * The request body was refused before it was parsed. Reported as 413 rather
 * than 400 so a client can tell "too big" from "malformed" and shrink the
 * payload instead of retrying it unchanged.
 */
export function payloadTooLarge(maxBytes: number): ContentError {
  return new ContentError(
    'payload_too_large',
    `request body exceeds the ${maxBytes}-byte limit`,
  );
}

export function notFound(entity: string, id: string): ContentError {
  return new ContentError('not_found', `${entity} "${id}" does not exist`);
}

export function slugConflict(entity: string, slug: string): ContentError {
  return new ContentError('slug_conflict', `${entity} "${slug}" already exists`);
}

/**
 * A payload that is structurally valid but points at something that is not
 * there — a place slug with no place, a destination that was never seeded.
 */
export function invalidReference(issues: FieldIssue[]): ContentError {
  return new ContentError(
    'invalid_reference',
    'one or more references do not resolve',
    issues,
  );
}

export function invalidState(message: string): ContentError {
  return new ContentError('invalid_state', message);
}

/**
 * A mutation that needs to know which version the caller is editing arrived
 * without `If-Match`. Answering 428 rather than applying the write is what
 * makes a lost update impossible instead of merely unlikely.
 */
/**
 * The caller is authenticated but this particular request is not allowed —
 * used for the same-origin requirement that cookie authentication brings with
 * it (ADR 0004 §4). Note that *object-level* refusals are deliberately 404s,
 * not 403s: a trip must not confirm its own existence to a non-owner.
 */
export function forbidden(message: string): ContentError {
  return new ContentError('forbidden', message);
}

export function preconditionRequired(message: string): ContentError {
  return new ContentError('precondition_required', message);
}

/**
 * The caller edited version N while the stored record has already moved past
 * it. The write is refused whole — never partially applied.
 */
export function versionConflict(
  entity: string,
  expected: number,
  actual: number,
): ContentError {
  return new ContentError(
    'version_conflict',
    `${entity} has moved on: you edited version ${expected}, the stored version is ${actual} — re-read it and retry`,
  );
}
