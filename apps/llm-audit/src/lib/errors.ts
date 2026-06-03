/**
 * Structured error shapes for the audit API. Route handlers always return one of
 * these as JSON with a non-2xx status — never a silent 200 with a broken body.
 */

/** Machine-readable error codes the client can branch on. */
export type AuditErrorCode =
  | 'invalid_request'
  | 'invalid_url'
  | 'crawl_failed'
  | 'no_pages'
  | 'internal_error';

export interface AuditErrorBody {
  error: {
    code: AuditErrorCode;
    message: string;
  };
}

/** Typed error thrown inside the pipeline; the route maps it to a JSON body + status. */
export class AuditError extends Error {
  readonly code: AuditErrorCode;
  readonly status: number;

  constructor(code: AuditErrorCode, message: string, status: number) {
    super(message);
    this.name = 'AuditError';
    this.code = code;
    this.status = status;
  }

  toBody(): AuditErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

/** Build a JSON-serializable error body from any thrown value. */
export function toErrorBody(err: unknown): { body: AuditErrorBody; status: number } {
  if (err instanceof AuditError) {
    return { body: err.toBody(), status: err.status };
  }
  const message = err instanceof Error ? err.message : 'Unexpected error during audit.';
  return {
    body: { error: { code: 'internal_error', message } },
    status: 500,
  };
}
