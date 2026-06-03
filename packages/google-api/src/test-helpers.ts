/**
 * Test-only helpers for building mock fetchers. Not exported from the package surface.
 *
 * (Lives in `src/` so the strict tsconfig type-checks it, but excluded from the public bundle —
 * `tsup` only emits the `src/index.ts` entry, which never imports this file.)
 */
import type { Fetcher, FetchInit, FetchResponse } from './http.js';

export interface RecordedCall {
  url: string;
  init: FetchInit | undefined;
}

export interface MockFetcher {
  fetcher: Fetcher;
  calls: RecordedCall[];
}

/** Build a mock {@link Fetcher} that returns the given JSON body with a 200 status. */
export function jsonFetcher(body: unknown, status = 200): MockFetcher {
  const calls: RecordedCall[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    return makeResponse(status, body);
  };
  return { fetcher, calls };
}

/** Build a mock {@link Fetcher} that returns a non-2xx error with a text body. */
export function errorFetcher(status: number, text: string): MockFetcher {
  const calls: RecordedCall[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: false,
      status,
      statusText: 'Error',
      json: async () => ({}),
      text: async () => text,
    };
  };
  return { fetcher, calls };
}

function makeResponse(status: number, body: unknown): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** Parse a recorded request body (JSON or form-encoded) back into a record for assertions. */
export function parseBody(call: RecordedCall): Record<string, unknown> {
  const raw = call.init?.body;
  if (typeof raw !== 'string' || raw.length === 0) return {};
  if (raw.trimStart().startsWith('{')) {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  }
  const params = new URLSearchParams(raw);
  const out: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}
