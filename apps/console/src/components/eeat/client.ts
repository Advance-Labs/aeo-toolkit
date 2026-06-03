/** Browser-side client for the E-E-A-T audit endpoint. Typed, no `any`. */
import type { EeatReport } from '@aeo/types';

/** Narrow an unknown JSON value to the `{ error: string }` shape. */
function readError(value: unknown): string | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  ) {
    return (value as { error: string }).error;
  }
  return null;
}

/**
 * POST the URL to `/api/audit/eeat` and return the parsed `EeatReport`.
 * Throws an `Error` carrying the server's message on a non-2xx response.
 */
export async function requestEeatAudit(url: string): Promise<EeatReport> {
  const response = await fetch('/api/audit/eeat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Unexpected response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(readError(payload) ?? `Scan failed (HTTP ${response.status}).`);
  }

  return payload as EeatReport;
}
