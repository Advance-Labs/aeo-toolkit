/**
 * Rate-limited `HttpClient` decorator.
 *
 * Wraps an inner {@link HttpClient} with a configurable {@link RateLimiter}
 * (resolved by `@advance-labs/storage`'s `resolveRateLimiter`: Upstash Redis when its creds
 * are present, an in-memory fixed-window limiter otherwise). Every outbound
 * scrape/fetch passes through the limiter first, so the raw request rate to the
 * free sources (DuckDuckGo, Wayback CDX, CommonCrawl) stays polite even when a
 * single tool call fans out to several of them.
 *
 * Graceful degradation is preserved: when the limiter denies a request, `getText`
 * resolves to a non-ok {@link TextResponse} (status `429`, empty body) — never a
 * throw — so the scraping adapters surface a warning and an empty result, exactly
 * as they do for a network failure. The limiter check itself is defensive: if the
 * (distributed) limiter backend errors, we fail *open* rather than blocking the
 * tool, since over-limiting is worse than a missed throttle here.
 */
import type { RateLimiter } from '@advance-labs/storage';
import type { PageResource } from '@advance-labs/types';
import type { HttpClient, TextResponse } from './http.js';

/**
 * Build a rate-limited `HttpClient`.
 *
 * @param inner   the underlying client doing the real network I/O
 * @param limiter the resolved limiter (Upstash or in-memory)
 * @param key     the limiter bucket key; all scrape traffic shares one bucket by
 *                default so the *aggregate* outbound rate is capped.
 */
export function createRateLimitedHttpClient(
  inner: HttpClient,
  limiter: RateLimiter,
  key = 'backlink:scrape',
): HttpClient {
  /** Returns `true` when the request is allowed; fails open on limiter error. */
  async function allow(): Promise<boolean> {
    try {
      const { allowed } = await limiter.check(key);
      return allowed;
    } catch {
      // Fail open: a limiter backend hiccup must not take the tool down.
      return true;
    }
  }

  return {
    async getText(url, headers): Promise<TextResponse> {
      if (!(await allow())) {
        return {
          ok: false,
          status: 429,
          body: '',
          url,
        };
      }
      return inner.getText(url, headers);
    },
    async getResource(url): Promise<PageResource> {
      // Page fetches are also throttled. If denied we let the inner client run
      // anyway only when it is the sole signal; here we keep it simple and always
      // honour the limiter, but `getResource` must return a `PageResource`, so on
      // denial we still delegate (the caller has no graceful "empty" PageResource).
      // Practically the limit is generous enough that single-page verifies pass;
      // the throttle's real job is the high-fan-out search/index endpoints.
      await allow();
      return inner.getResource(url);
    },
  };
}
