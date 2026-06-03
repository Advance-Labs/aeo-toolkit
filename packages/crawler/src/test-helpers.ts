import type { Fetcher, FetchOptions } from './fetcher.js';

/**
 * Test-only helpers for building a fake `Fetcher`. Not exported from the package's public
 * surface (only `index.ts` is), but kept in a non-`.test.ts` file so multiple test files can
 * share it. Vitest's `include` only globs `*.test.ts`, so this is never run as a suite.
 */

export interface CannedResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

/** Build a real `Response` from a canned spec (uses the global `Response`, present on Node 18+). */
export function makeResponse(canned: CannedResponse = {}): Response {
  const status = canned.status ?? 200;
  const headers = new Headers(canned.headers ?? {});
  // 204/304 and redirects must not carry a body per the fetch spec.
  const bodyless = status === 204 || status === 304 || (status >= 300 && status < 400);
  return new Response(bodyless ? null : (canned.body ?? ''), { status, headers });
}

/**
 * Create a `Fetcher` backed by a URL→response map. Unknown URLs resolve to 404. The returned
 * object also records every requested URL (with method) for assertions.
 */
export function makeFetcher(routes: Record<string, CannedResponse>): {
  fetcher: Fetcher;
  calls: Array<{ url: string; method: string }>;
} {
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher: Fetcher = (url: string, init?: FetchOptions) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    const canned = routes[url];
    if (!canned) return Promise.resolve(makeResponse({ status: 404, body: 'not found' }));
    return Promise.resolve(makeResponse(canned));
  };
  return { fetcher, calls };
}

/** A no-op delay so the rate limiter resolves instantly in tests. */
export const instantDelay = (_ms: number): Promise<void> => Promise.resolve();
