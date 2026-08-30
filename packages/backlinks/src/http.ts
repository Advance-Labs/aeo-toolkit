/**
 * Outbound HTTP seam.
 *
 * All scraping tools (DuckDuckGo, Wayback CDX) and the link-verifier route their
 * network access through this small typed interface so handlers stay pure and
 * fully unit-testable: tests inject a fake `HttpClient`, no live network needed.
 *
 * For page fetches we reuse `@advance-labs/crawler`'s `fetchResource`, which already gives
 * us redirect-chain capture, timing, and a normalised `PageResource`. For the
 * search/archive HTML+JSON endpoints we expose a thin `getText` helper.
 */
import { fetchResource } from '@advance-labs/crawler';
import type { PageResource } from '@advance-labs/types';

export interface TextResponse {
  ok: boolean;
  status: number;
  /** Response body as text; empty string when the request failed. */
  body: string;
  /** Final URL after redirects (best-effort). */
  url: string;
}

/**
 * The injectable network seam. Both methods resolve (never reject) on transport
 * failure so callers can degrade gracefully rather than throw — MCP tools must
 * return structured results, not crash the server.
 */
export interface HttpClient {
  /** GET a URL and return its body as text plus status metadata. */
  getText(url: string, headers?: Record<string, string>): Promise<TextResponse>;
  /** Fetch a page as a normalised `PageResource` (used by `verify_page_links`). */
  getResource(url: string): Promise<PageResource>;
}

export interface LiveHttpClientOptions {
  userAgent: string;
  requestTimeoutMs: number;
}

/**
 * The production `HttpClient`. `getResource` delegates to `@advance-labs/crawler`;
 * `getText` uses the runtime global `fetch` with an abort timeout. Both swallow
 * transport errors into a non-ok response so tools degrade instead of throwing.
 */
export function createLiveHttpClient(opts: LiveHttpClientOptions): HttpClient {
  return {
    async getText(url, headers = {}): Promise<TextResponse> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.requestTimeoutMs);
      try {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'user-agent': opts.userAgent, ...headers },
        });
        const body = await res.text();
        return { ok: res.ok, status: res.status, body, url: res.url || url };
      } catch {
        // STUB: transport/abort failures degrade to an empty non-ok response.
        return { ok: false, status: 0, body: '', url };
      } finally {
        clearTimeout(timer);
      }
    },
    async getResource(url): Promise<PageResource> {
      return fetchResource(url, {
        userAgent: opts.userAgent,
        requestTimeoutMs: opts.requestTimeoutMs,
        includeBody: true,
      });
    },
  };
}
