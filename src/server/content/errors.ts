/**
 * Domain errors carry a stable machine code and the HTTP status the API layer
 * should map them to, so a route handler never has to guess a status from a
 * message. Codes are developer-facing contract — they are not UI strings and
 * are deliberately not localized (CLAUDE.md rule 1 governs user-visible copy).
 */
export type ContentErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'admin_auth_unconfigured'
  | 'not_found'
  | 'slug_conflict'
  | 'invalid_reference'
  | 'invalid_state';

const STATUS_BY_CODE: Record<ContentErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  admin_auth_unconfigured: 503,
  not_found: 404,
  slug_conflict: 409,
  invalid_reference: 422,
  invalid_state: 409,
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
