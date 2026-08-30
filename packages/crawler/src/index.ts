/**
 * @advance-labs/crawler — a polite, bounded HTTP crawler.
 *
 * Sitemap-first discovery, BFS link-following, robots.txt-aware, per-host rate limited, with
 * redirect-chain capture and well-known site-file detection. All network I/O routes through an
 * injectable `Fetcher` (defaults to global `fetch`) so consumers and tests stay network-free.
 */

export { crawl } from './crawl.js';
export type { CrawlRuntimeOptions } from './crawl.js';

export { fetchResource } from './fetch-resource.js';
export type { FetchResourceOptions } from './fetch-resource.js';

export { parseRobotsTxt, emptyRobotsTxt } from './robots.js';
export { parseSitemap, parseSitemapDocument } from './sitemap.js';
export type { SitemapKind, ParsedSitemap } from './sitemap.js';

export { detectSiteFiles } from './site-files.js';
export type { DetectSiteFilesOptions } from './site-files.js';

export { extractLinks, sameOrigin, sameRegistrableSite, hostOf } from './links.js';
export { PerHostRateLimiter } from './rate-limit.js';

export { resolveFetcher, CrawlerError } from './fetcher.js';
export type { Fetcher, FetchOptions } from './fetcher.js';

export {
  AI_BOT_NAMES,
  DEFAULT_USER_AGENT,
  DEFAULT_CONCURRENCY,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_PER_HOST_RATE_LIMIT_MS,
  DEFAULT_MAX_DEPTH,
  MAX_REDIRECT_HOPS,
} from './constants.js';
