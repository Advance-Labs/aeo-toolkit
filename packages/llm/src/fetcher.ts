/**
 * Injectable I/O seam.
 *
 * The package never references the global `fetch` directly in its provider logic; every network
 * call flows through a `Fetcher`. The default binds the global `fetch` (available in Node 18+ and
 * all modern runtimes), but tests inject a mock so no real HTTP ever happens.
 */

/** Minimal structural subset of the Fetch API response the client relies on. */
export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  text(): Promise<string>;
}

/** The injectable network function. Structurally compatible with the global `fetch`. */
export type Fetcher = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchResponse>;

/**
 * Default fetcher bound to the runtime global `fetch`.
 *
 * Resolved lazily so the package imports cleanly in environments that polyfill `fetch` after
 * module load. Throwing here (rather than at import time) keeps the module side-effect free.
 */
export const defaultFetcher: Fetcher = (url, init) => {
  const g = globalThis as { fetch?: unknown };
  if (typeof g.fetch !== 'function') {
    throw new Error(
      '@advance-labs/llm: no global `fetch` available in this runtime; pass `opts.fetcher` explicitly.',
    );
  }
  const f = g.fetch as (input: string, init: unknown) => Promise<FetchResponse>;
  return f(url, init);
};
