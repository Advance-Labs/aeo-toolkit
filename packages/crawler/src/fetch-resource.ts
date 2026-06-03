import type { PageResource, RedirectHop, Url } from '@aeo/types';
import { type Fetcher, resolveFetcher, CrawlerError } from './fetcher.js';
import { DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_USER_AGENT, MAX_REDIRECT_HOPS } from './constants.js';

/** Options for a single resource fetch. All fields optional; sensible polite defaults applied. */
export interface FetchResourceOptions {
  /** Injectable HTTP function; defaults to global `fetch`. Tests pass a fake here. */
  fetcher?: Fetcher;
  requestTimeoutMs?: number;
  userAgent?: string;
  /** HTTP method; defaults to GET. detectSiteFiles uses HEAD then falls back to GET. */
  method?: 'GET' | 'HEAD';
  /** Extra request headers merged over the default UA/Accept set. */
  headers?: Record<string, string>;
  /** Whether to read and attach the response body (skipped for HEAD or when false). */
  includeBody?: boolean;
  /** Max redirect hops to follow before returning the last redirect response. */
  maxRedirects?: number;
}

/**
 * Fetch a single URL, following redirects manually so the full `redirectChain` is captured.
 * Returns a `PageResource` describing status, headers, timing, final URL, content-type and
 * (optionally) the body. Network/timeout failures are returned as a non-`ok` resource with an
 * `error` string rather than thrown, so a single bad page never aborts a crawl.
 */
export async function fetchResource(
  url: Url,
  opts: FetchResourceOptions = {},
): Promise<PageResource> {
  const fetcher = resolveFetcher(opts.fetcher);
  const method = opts.method ?? 'GET';
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECT_HOPS;
  const wantBody = (opts.includeBody ?? method === 'GET') && method !== 'HEAD';

  const headers: Record<string, string> = {
    'user-agent': opts.userAgent ?? DEFAULT_USER_AGENT,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ...opts.headers,
  };

  const started = Date.now();
  const redirectChain: RedirectHop[] = [];
  let currentUrl = url;

  try {
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const response = await withTimeout(
        (signal) =>
          fetcher(currentUrl, {
            method,
            headers,
            redirect: 'manual',
            signal,
          }),
        timeoutMs,
      );

      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        redirectChain.push({ url: currentUrl, status: response.status });
        if (!location) {
          // Redirect status with no Location — treat as terminal.
          return finalize(url, currentUrl, response, redirectChain, started, false);
        }
        if (hop === maxRedirects) {
          // Hit the cap: return this redirect response as terminal rather than looping.
          return finalize(url, currentUrl, response, redirectChain, started, false);
        }
        currentUrl = resolveLocation(currentUrl, location);
        continue;
      }

      return finalize(url, currentUrl, response, redirectChain, started, wantBody);
    }

    // Unreachable: the loop always returns. Kept for exhaustiveness.
    throw new CrawlerError('redirect loop exited without a response');
  } catch (err) {
    return {
      url,
      finalUrl: currentUrl,
      status: 0,
      ok: false,
      headers: {},
      timingMs: Date.now() - started,
      redirectChain,
      error: errorMessage(err),
    };
  }
}

/** Convert a settled (non-redirect or terminal) `Response` into a `PageResource`. */
async function finalize(
  requestedUrl: Url,
  finalUrl: Url,
  response: Response,
  redirectChain: RedirectHop[],
  started: number,
  readBody: boolean,
): Promise<PageResource> {
  const headers = headersToRecord(response.headers);
  const resource: PageResource = {
    url: requestedUrl,
    finalUrl,
    status: response.status,
    ok: response.ok,
    headers,
    timingMs: Date.now() - started,
    redirectChain,
  };

  const contentType = headers['content-type'];
  if (contentType) resource.contentType = contentType;

  if (readBody) {
    try {
      resource.body = await response.text();
    } catch (err) {
      resource.error = errorMessage(err);
    }
  }

  return resource;
}

/** Run `op` against an abort signal that fires after `timeoutMs`, always clearing the timer. */
async function withTimeout<T>(
  op: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await op(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** Resolve a possibly-relative `Location` header against the current URL. */
function resolveLocation(base: Url, location: string): Url {
  try {
    return new URL(location, base).toString();
  } catch {
    return location;
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.name === 'AbortError' ? 'request timed out' : err.message;
  }
  return String(err);
}
