/**
 * Browser-side fetch helpers for the audit API. Centralizes request/response
 * shapes so the page component stays declarative. These run in the client bundle.
 *
 * Mirrors the server contract exposed by the API routes:
 *   - POST `/api/audit/technical`      body `{ url, maxPages? }` → {@link AuditReport}.
 *   - POST `/api/audit/technical/pdf`  body `{ report }`         → PDF Blob.
 */
import type { AuditReport } from '@aeo/types';

/** Structured error body the audit routes return on a non-2xx response. */
interface AuditErrorBody {
  error: { code: string; message: string };
}

/** Thrown when the API responds with a non-2xx, structured error body. */
export class AuditApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'AuditApiError';
    this.status = status;
    this.code = code;
  }
}

function isErrorBody(value: unknown): value is AuditErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as Record<string, unknown>)['error'];
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  return typeof e['code'] === 'string' && typeof e['message'] === 'string';
}

/** POST /api/audit/technical — returns the computed AuditReport or throws AuditApiError. */
export async function requestAudit(url: string, maxPages?: number): Promise<AuditReport> {
  const res = await fetch('/api/audit/technical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(maxPages === undefined ? { url } : { url, maxPages }),
  });

  if (!res.ok) {
    const payload: unknown = await res.json().catch(() => null);
    if (isErrorBody(payload)) {
      throw new AuditApiError(payload.error.message, res.status, payload.error.code);
    }
    throw new AuditApiError(`Audit failed (HTTP ${res.status}).`, res.status, 'unknown');
  }

  return (await res.json()) as AuditReport;
}

/**
 * POST /api/audit/technical/pdf with an already-computed report, returning the PDF
 * blob. Re-uses the report so the server does not crawl a second time.
 */
export async function requestReportPdf(report: AuditReport): Promise<Blob> {
  const res = await fetch('/api/audit/technical/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report }),
  });

  if (!res.ok) {
    const payload: unknown = await res.json().catch(() => null);
    if (isErrorBody(payload)) {
      throw new AuditApiError(payload.error.message, res.status, payload.error.code);
    }
    throw new AuditApiError(`PDF export failed (HTTP ${res.status}).`, res.status, 'unknown');
  }

  return res.blob();
}

/** Trigger a browser download of a Blob with the given filename. No-op outside the DOM. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}
