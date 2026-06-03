/**
 * Injectable HTTP seam.
 *
 * All network I/O in this package flows through a `Fetcher` so that logic is unit-testable
 * without a live network. The default is the global `fetch`; tests inject a mock that asserts
 * request shape and returns canned responses.
 */

/** Minimal structural subset of the DOM `fetch` we depend on — keeps the seam small and mockable. */
export type Fetcher = (input: string, init?: FetchInit) => Promise<FetchResponse>;

/** Structural subset of `RequestInit` we use (method, headers, body). */
export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/** Structural subset of the `Response` we read back. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * Thrown when a Google API responds with a non-2xx status. Carries the HTTP status and the raw
 * response body so callers can surface structured errors instead of silent fallbacks.
 */
export class GoogleApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.body = body;
  }
}

/** The default fetcher: the platform global `fetch`. Resolved lazily so tests can run in any env. */
export function defaultFetcher(): Fetcher {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch is unavailable; pass an explicit `fetcher` to the client');
  }
  return fetch as unknown as Fetcher;
}

/**
 * Perform a JSON request against a Google endpoint and return the parsed body.
 *
 * Centralizes auth header injection, JSON encoding, and error normalization so every client
 * method stays a thin mapper. Throws {@link GoogleApiError} on non-2xx responses.
 */
export async function requestJson(
  fetcher: Fetcher,
  url: string,
  init: {
    method?: string;
    accessToken?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers ?? {}),
  };
  if (init.accessToken !== undefined) {
    headers['Authorization'] = `Bearer ${init.accessToken}`;
  }

  let body: string | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  const res = await fetcher(url, {
    method: init.method ?? (body !== undefined ? 'POST' : 'GET'),
    headers,
    ...(body !== undefined ? { body } : {}),
  });

  if (!res.ok) {
    const raw = await safeReadText(res);
    throw new GoogleApiError(
      `Google API request failed: ${res.status} ${res.statusText}`,
      res.status,
      raw,
    );
  }

  return res.json();
}

/**
 * Perform a form-encoded (`application/x-www-form-urlencoded`) POST and return the parsed JSON
 * body. Used by the OAuth token endpoint, which does not accept JSON request bodies.
 */
export async function requestForm(
  fetcher: Fetcher,
  url: string,
  form: URLSearchParams,
): Promise<unknown> {
  const res = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const raw = await safeReadText(res);
    throw new GoogleApiError(
      `Google API request failed: ${res.status} ${res.statusText}`,
      res.status,
      raw,
    );
  }

  return res.json();
}

async function safeReadText(res: FetchResponse): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** Narrow an unknown JSON value to a plain record. */
export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Narrow an unknown JSON value to an array of records (Google list responses). */
export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      out.push(item as Record<string, unknown>);
    }
  }
  return out;
}

/** Coerce an unknown JSON value to a finite number, defaulting to 0. */
export function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Coerce an unknown JSON value to a string, defaulting to ''. */
export function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
