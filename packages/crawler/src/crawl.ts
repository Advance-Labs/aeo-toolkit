import pLimit from 'p-limit';
import type {
  CrawledPage,
  CrawlOptions,
  CrawlResult,
  RobotsTxt,
  SitemapEntry,
  Url,
} from '@advance-labs/types';
import { type Fetcher, resolveFetcher } from './fetcher.js';
import { fetchResource } from './fetch-resource.js';
import { parseRobotsTxt, emptyRobotsTxt } from './robots.js';
import { parseSitemapDocument } from './sitemap.js';
import { detectSiteFiles } from './site-files.js';
import { extractLinks, hostOf, sameOrigin, sameRegistrableSite } from './links.js';
import { PerHostRateLimiter } from './rate-limit.js';
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_DEPTH,
  DEFAULT_PER_HOST_RATE_LIMIT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from './constants.js';

/** `crawl` accepts everything `CrawlOptions` has plus the injectable fetcher (kept off the shared type). */
export interface CrawlRuntimeOptions extends CrawlOptions {
  /** Injectable HTTP function; defaults to global `fetch`. Tests pass a fake so no network is hit. */
  fetcher?: Fetcher;
  /** Injectable delay (for the rate limiter); defaults to real `setTimeout`. Tests pass a no-op. */
  delay?: (ms: number) => Promise<void>;
}

/**
 * Crawl a site starting at `rootUrl`. Strategy:
 *   1. Fetch + parse robots.txt (used both as a gate when `respectRobotsTxt` and as a sitemap source).
 *   2. Detect well-known site files (robots/sitemap/llms.txt/favicon).
 *   3. Seed the frontier from sitemaps (sitemap-first), then fall back to BFS link-following.
 *   4. Fetch up to `maxPages` pages, honoring per-host rate limits and `concurrency` (via p-limit).
 *
 * Returns a `CrawlResult` with every fetched page, the discovered sitemap, parsed robots, file
 * presence, and timing metadata. All I/O goes through the injected/default fetcher.
 */
export async function crawl(rootUrl: Url, opts: CrawlRuntimeOptions): Promise<CrawlResult> {
  const fetcher = resolveFetcher(opts.fetcher);
  const startedAt = new Date().toISOString();

  const maxPages = Math.max(0, Math.floor(opts.maxPages));
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const requestTimeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const respectRobotsTxt = opts.respectRobotsTxt ?? true;
  const followSitemap = opts.followSitemap ?? true;
  const includeSubdomains = opts.includeSubdomains ?? false;
  const rateLimitMs = opts.perHostRateLimitMs ?? DEFAULT_PER_HOST_RATE_LIMIT_MS;

  const https = isHttps(rootUrl);
  const limit = pLimit(concurrency);
  const rateLimiter = new PerHostRateLimiter(rateLimitMs, undefined, opts.delay);

  const fetchOne = (url: Url): Promise<CrawledPage> =>
    limit(async () => {
      await rateLimiter.acquire(hostOf(url));
      return {
        ...(await fetchResource(url, { fetcher, requestTimeoutMs, userAgent, includeBody: true })),
        depth: 0,
      };
    });

  // --- 1. robots.txt + 2. site files (independent, run concurrently) ---
  const [robots, filePresence] = await Promise.all([
    loadRobots(rootUrl, fetcher, requestTimeoutMs, userAgent),
    detectSiteFiles(rootUrl, { fetcher, requestTimeoutMs, userAgent }),
  ]);

  const allowed = (url: Url): boolean =>
    !respectRobotsTxt || isAllowedByRobots(robots, url, userAgent);

  // --- 3. Seed the frontier: sitemap-first, then the root itself ---
  const sitemap: SitemapEntry[] = followSitemap
    ? await collectSitemaps(robots, rootUrl, fetcher, requestTimeoutMs, userAgent)
    : [];

  const inScope = (url: Url): boolean =>
    includeSubdomains ? sameRegistrableSite(url, rootUrl) : sameOrigin(url, rootUrl);

  // Frontier holds {url, depth, discoveredFrom}. Root is depth 0 and first in line.
  const queued = new Set<Url>();
  const frontier: Array<{ url: Url; depth: number; from?: Url }> = [];
  const enqueue = (url: Url, depth: number, from?: Url): void => {
    if (queued.has(url) || !inScope(url) || depth > maxDepth || !allowed(url)) return;
    queued.add(url);
    frontier.push(from === undefined ? { url, depth } : { url, depth, from });
  };

  enqueue(rootUrl, 0);
  for (const entry of sitemap) enqueue(entry.loc, 0, rootUrl);

  // --- 4. BFS fetch loop with maxPages cap ---
  const pages: CrawledPage[] = [];
  while (frontier.length > 0 && pages.length < maxPages) {
    // Drain one BFS "wave" up to remaining budget, fetch concurrently, then expand discovered links.
    const remaining = maxPages - pages.length;
    const wave = frontier.splice(0, remaining);

    const fetched = await Promise.all(
      wave.map(async (item) => {
        const page = await fetchOne(item.url);
        page.depth = item.depth;
        if (item.from !== undefined) page.discoveredFrom = item.from;
        return page;
      }),
    );

    for (const page of fetched) {
      if (pages.length >= maxPages) break;
      pages.push(page);
      // Only follow links from successful HTML responses.
      if (page.ok && isHtml(page.contentType) && page.body) {
        for (const link of extractLinks(page.body, page.finalUrl)) {
          enqueue(link, page.depth + 1, page.finalUrl);
        }
      }
    }
  }

  return {
    rootUrl,
    https,
    pages,
    sitemap,
    robots,
    filePresence,
    startedAt,
    finishedAt: new Date().toISOString(),
    pageCount: pages.length,
  };
}

/** Fetch and parse robots.txt; returns an empty (all-allowed) robots on any failure. */
async function loadRobots(
  rootUrl: Url,
  fetcher: Fetcher,
  requestTimeoutMs: number,
  userAgent: string,
): Promise<RobotsTxt> {
  const robotsUrl = originOf(rootUrl) + '/robots.txt';
  const res = await fetchResource(robotsUrl, {
    fetcher,
    requestTimeoutMs,
    userAgent,
    includeBody: true,
  });
  if (res.ok && typeof res.body === 'string' && res.body.trim().length > 0) {
    return parseRobotsTxt(res.body, robotsUrl);
  }
  return emptyRobotsTxt(robotsUrl);
}

/**
 * Collect sitemap entries. Starts from sitemaps declared in robots.txt (falling back to the
 * conventional `/sitemap.xml`), fetches each, and expands one level of sitemap-index nesting so
 * index entries resolve to their child page URLs. Bounded to avoid runaway fetches.
 */
async function collectSitemaps(
  robots: RobotsTxt,
  rootUrl: Url,
  fetcher: Fetcher,
  requestTimeoutMs: number,
  userAgent: string,
): Promise<SitemapEntry[]> {
  const seeds = robots.sitemaps.length > 0 ? robots.sitemaps : [originOf(rootUrl) + '/sitemap.xml'];

  const collected: SitemapEntry[] = [];
  const seenLocs = new Set<Url>();
  const visitedSitemaps = new Set<Url>();
  const MAX_SITEMAP_FETCHES = 50;

  const queue: Url[] = [...new Set(seeds)];
  while (queue.length > 0 && visitedSitemaps.size < MAX_SITEMAP_FETCHES) {
    const sitemapUrl = queue.shift();
    if (sitemapUrl === undefined || visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);

    const res = await fetchResource(sitemapUrl, {
      fetcher,
      requestTimeoutMs,
      userAgent,
      includeBody: true,
    });
    if (!res.ok || typeof res.body !== 'string') continue;

    const doc = parseSitemapDocument(res.body);
    if (doc.kind === 'sitemapindex') {
      // Index: every entry is a child sitemap to fetch and expand.
      for (const entry of doc.entries) {
        if (!visitedSitemaps.has(entry.loc)) queue.push(entry.loc);
      }
      continue;
    }

    // urlset (or unknown, which yields no entries): entries are page URLs.
    for (const entry of doc.entries) {
      if (!seenLocs.has(entry.loc)) {
        seenLocs.add(entry.loc);
        collected.push(entry);
      }
    }
  }

  return collected;
}

function isAllowedByRobots(robots: RobotsTxt, url: Url, userAgent: string): boolean {
  // Find the most specific group matching this UA; default to allowed when no rule matches.
  const path = pathOf(url);
  const group =
    robots.groups.find((g) => g.userAgents.some((ua) => uaMatches(ua, userAgent))) ??
    robots.groups.find((g) => g.userAgents.includes('*'));
  if (!group) return true;

  const disallowed = group.disallow.some((rule) => matchesRule(rule, path));
  if (!disallowed) return true;
  // An explicit Allow that matches overrides a Disallow.
  return group.allow.some((rule) => matchesRule(rule, path));
}

function uaMatches(rule: string, userAgent: string): boolean {
  if (rule === '*') return true;
  return userAgent.toLowerCase().includes(rule.toLowerCase());
}

/** Simple robots path-prefix match supporting a trailing `*` wildcard and empty (= no-op) rules. */
function matchesRule(rule: string, path: string): boolean {
  if (rule === '') return false; // empty Disallow allows everything
  const normalized = rule.endsWith('*') ? rule.slice(0, -1) : rule;
  return path.startsWith(normalized);
}

function isHttps(url: Url): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function isHtml(contentType: string | undefined): boolean {
  if (!contentType) return true; // be permissive when the server omits content-type
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

function originOf(url: Url): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, '');
  }
}

function pathOf(url: Url): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return '/';
  }
}
