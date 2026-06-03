/**
 * I/O seam for the crawler. Every network call routes through a `Fetcher` function so tests
 * can inject canned responses and never touch the real network. The default is the global
 * `fetch` (Node 20+ / browsers), so production code needs no extra HTTP dependency.
 */

/** Minimal subset of `RequestInit` the crawler relies on. */
export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  /** 'manual' lets us capture redirect chains ourselves; 'follow' delegates to the runtime. */
  redirect?: 'manual' | 'follow' | 'error';
  signal?: AbortSignal;
}

/**
 * The injectable HTTP function. Structurally compatible with the global `fetch`, so
 * `globalThis.fetch` can be passed directly and tests can pass a fake returning a `Response`.
 */
export type Fetcher = (url: string, init?: FetchOptions) => Promise<Response>;

/**
 * Resolve the fetcher to use: the caller-provided one, else the runtime global `fetch`.
 * Throws a typed error if neither is available (e.g. an older Node without global fetch).
 */
export function resolveFetcher(injected?: Fetcher): Fetcher {
  if (injected) return injected;
  const globalFetch = (globalThis as { fetch?: Fetcher }).fetch;
  if (!globalFetch) {
    throw new CrawlerError(
      'No fetch implementation available. Pass `fetcher` in options or run on Node 20+.',
    );
  }
  return globalFetch.bind(globalThis);
}

/** Typed error thrown by the crawler so callers can `instanceof`-narrow. */
export class CrawlerError extends Error {
  override readonly name = 'CrawlerError';
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}
