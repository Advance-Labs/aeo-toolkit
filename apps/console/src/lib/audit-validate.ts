/**
 * Request-body validation for the technical-audit endpoint. Kept dependency-free (no zod) so the
 * app's only runtime deps are the @advance-labs/* packages + Next/React, per the spec.
 */
import { AuditError } from './audit-errors.js';

/** Default page cap; overridable per-request and via the AUDIT_MAX_PAGES env var. */
export const DEFAULT_MAX_PAGES = 50;
/** Hard ceiling so a caller can never request an unbounded crawl. */
export const MAX_PAGES_CEILING = 100;

export interface AuditRequest {
  url: string;
  maxPages: number;
}

/** Resolve the configured default page cap, honoring AUDIT_MAX_PAGES when present and valid. */
export function configuredDefaultMaxPages(): number {
  const raw = process.env.AUDIT_MAX_PAGES;
  if (raw === undefined) return DEFAULT_MAX_PAGES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_PAGES;
  return Math.min(parsed, MAX_PAGES_CEILING);
}

/**
 * Validate and normalize a raw request payload into an {@link AuditRequest}.
 * Throws a typed {@link AuditError} (mapped to a 4xx by the route) on bad input.
 */
export function parseAuditRequest(payload: unknown): AuditRequest {
  if (typeof payload !== 'object' || payload === null) {
    throw new AuditError('invalid_request', 'Request body must be a JSON object.', 400);
  }

  const record = payload as Record<string, unknown>;
  const rawUrl = record['url'];
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new AuditError('invalid_request', 'A non-empty "url" string is required.', 400);
  }

  const url = normalizeUrl(rawUrl.trim());

  const fallback = configuredDefaultMaxPages();
  const rawMaxPages = record['maxPages'];
  let maxPages = fallback;
  if (rawMaxPages !== undefined) {
    if (typeof rawMaxPages !== 'number' || !Number.isFinite(rawMaxPages)) {
      throw new AuditError('invalid_request', '"maxPages" must be a number.', 400);
    }
    maxPages = Math.floor(rawMaxPages);
    if (maxPages < 1) {
      throw new AuditError('invalid_request', '"maxPages" must be at least 1.', 400);
    }
    maxPages = Math.min(maxPages, MAX_PAGES_CEILING);
  }

  return { url, maxPages };
}

/** Add an https:// scheme when missing, then validate the URL is well-formed http(s). */
export function normalizeUrl(input: string): string {
  // Detect ANY scheme (e.g. ftp://) so we don't prepend https:// to a non-http(s) URL and
  // accidentally make it parse as valid — `https://ftp://x` would otherwise sneak through.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  const withScheme = hasScheme ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new AuditError('invalid_url', `"${input}" is not a valid URL.`, 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AuditError('invalid_url', 'Only http(s) URLs are supported.', 400);
  }
  return parsed.toString();
}
