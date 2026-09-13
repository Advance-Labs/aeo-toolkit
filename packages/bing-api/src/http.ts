/**
 * Injectable HTTP seam for the Bing Webmaster JSON API.
 *
 * Mirrors the seam `@advance-labs/google-api` established: all network I/O flows
 * through a `Fetcher` so client logic is unit-testable without a network.
 *
 * Two Bing-specific concerns live here so no caller repeats them:
 *  - authentication is a flat `?apikey=` query parameter, not a header;
 *  - every payload is wrapped in a `d` node (a WCF artifact) which is unwrapped
 *    once, here, rather than in each of the twelve client methods.
 */

/** Minimal structural subset of the DOM `fetch` we depend on. */
export type Fetcher = (input: string, init?: FetchInit) => Promise<FetchResponse>;

/** Structural subset of `RequestInit` we use. */
export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
}

/** Structural subset of `Response` we read back. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * Thrown when Bing responds non-2xx, or when the response is not the shape the
 * API contract promises. Carries status and raw body so callers can surface a
 * structured error instead of a silent fallback.
 */
export class BingApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'BingApiError';
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, BingApiError.prototype);
  }
}

/** The default fetcher: the platform global. Resolved lazily so tests run anywhere. */
export function defaultFetcher(): Fetcher {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch is unavailable; pass an explicit `fetcher` to the client');
  }
  return fetch as unknown as Fetcher;
}

export interface RequestBingOptions {
  baseUrl: string;
  /** The Bing method name, e.g. `GetQueryStats`. */
  method: string;
  apiKey: string;
  /** Query parameters; `undefined` values are dropped, never stringified. */
  params?: Record<string, string | number | undefined>;
}

/**
 * Call a Bing Webmaster JSON method and return the **unwrapped** `d` payload.
 *
 * @throws {BingApiError} on non-2xx, on a body that is not an object, and on a
 *   body missing the `d` envelope.
 */
export async function requestBing(
  fetcher: Fetcher,
  opts: RequestBingOptions,
): Promise<unknown> {
  const search = new URLSearchParams({ apikey: opts.apiKey });
  for (const [key, value] of Object.entries(opts.params ?? {})) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }

  const base = opts.baseUrl.endsWith('/') ? opts.baseUrl : `${opts.baseUrl}/`;
  const url = `${base}${opts.method}?${search.toString()}`;

  const res = await fetcher(url, { method: 'GET', headers: { Accept: 'application/json' } });

  if (!res.ok) {
    const raw = await safeReadText(res);
    // The api key is in the URL, never in the message or the body we echo.
    throw new BingApiError(
      `Bing Webmaster request failed for ${opts.method}: ${res.status} ${res.statusText}`,
      res.status,
      raw,
    );
  }

  const parsed = await res.json();
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BingApiError(
      `Bing Webmaster returned a non-object body for ${opts.method}`,
      res.status,
      typeof parsed,
    );
  }

  if (!('d' in parsed)) {
    throw new BingApiError(
      `Bing Webmaster response for ${opts.method} is missing the "d" envelope; ` +
        `received keys: ${Object.keys(parsed).join(', ') || '(none)'}`,
      res.status,
      '',
    );
  }

  return (parsed as { d: unknown }).d;
}

async function safeReadText(res: FetchResponse): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** Narrow an unknown JSON value to an array of records. */
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

/** Narrow an unknown JSON value to a plain record. */
export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Coerce to a finite number, defaulting to 0. Use only for count-like fields. */
export function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Coerce to a string, defaulting to ''. */
export function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
