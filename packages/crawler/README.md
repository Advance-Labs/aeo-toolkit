# @advance-labs/crawler

A polite, bounded HTTP crawler for the AEO Toolkit. It discovers a site's pages sitemap-first,
then follows on-site links breadth-first up to a hard page cap. It is robots.txt-aware, rate-limits
per host, captures redirect chains, and detects the well-known crawl-hint / trust files
(`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `favicon.ico`). All network I/O is routed
through an injectable `Fetcher` (default: the global `fetch`), so callers and tests never need a
live network.

## Usage

```ts
import { crawl, fetchResource, parseRobotsTxt, parseSitemap, AI_BOT_NAMES } from '@advance-labs/crawler';

// Crawl up to 50 pages, respecting robots.txt and spacing requests 500ms per host.
const result = await crawl('https://example.com/', {
  maxPages: 50,
  respectRobotsTxt: true,
  perHostRateLimitMs: 500,
  concurrency: 4,
});

console.log(result.pageCount, 'pages');
console.log(result.robots.aiBotDirectives); // which AI crawlers are allowed at the root
console.log(result.filePresence);           // { robotsTxt, sitemapXml, llmsTxt, llmsFullTxt, favicon }

// Single resource fetch with redirect-chain capture.
const page = await fetchResource('https://example.com/');

// Inject a fake fetcher for tests — no real network.
await crawl('https://example.com/', { maxPages: 10, fetcher: myFakeFetch });
```

## Public API

| Export | Kind | Description |
| --- | --- | --- |
| `crawl(rootUrl, opts)` | `Promise<CrawlResult>` | Sitemap-first + BFS link-following crawl, capped at `opts.maxPages`. Honors robots.txt, per-host rate limit, and concurrency. |
| `fetchResource(url, opts?)` | `Promise<PageResource>` | One fetch with status, headers, timing, final URL, content-type, body, and manual redirect-chain capture. |
| `parseRobotsTxt(raw, url)` | `RobotsTxt` | Parses robots.txt; populates `sitemaps[]`, grouped directives, and an `aiBotDirectives[]` entry for every `AiBotName`. |
| `emptyRobotsTxt(url)` | `RobotsTxt` | An all-allowed robots result for sites that have none. |
| `parseSitemap(xml)` | `SitemapEntry[]` | Parses `<urlset>` and `<sitemapindex>` documents; tolerant of malformed input. |
| `detectSiteFiles(rootUrl, opts?)` | `Promise<SiteFilePresence>` | HEAD/GET probes for robots, sitemap, llms.txt, llms-full.txt, favicon. |
| `extractLinks(html, baseUrl)` | `Url[]` | Dependency-free regex href extraction, absolutized and de-duplicated. |
| `sameOrigin`, `sameRegistrableSite`, `hostOf` | helpers | URL scope + host helpers used by the crawl frontier. |
| `PerHostRateLimiter` | class | Per-host request spacing with an injectable clock/delay. |
| `resolveFetcher`, `CrawlerError` | runtime | Fetcher resolution and the package's typed error. |
| `Fetcher`, `FetchOptions`, `CrawlRuntimeOptions`, `FetchResourceOptions`, `DetectSiteFilesOptions` | types | The injectable I/O seam and option shapes. |
| `AI_BOT_NAMES` | `readonly AiBotName[]` | The known AI/LLM crawler user-agents probed in robots.txt. |
| `DEFAULT_*`, `MAX_REDIRECT_HOPS` | constants | Tunable defaults (user-agent, concurrency, timeout, depth, redirect cap). |

All domain shapes (`CrawlResult`, `PageResource`, `RobotsTxt`, `SitemapEntry`, `SiteFilePresence`,
`AiBotName`, `CrawlOptions`, …) are imported from `@advance-labs/types`; this package never redefines them.

## Status

**Implemented.** No stubs. The single I/O seam is the injectable `Fetcher` (defaults to global
`fetch` on Node 20+); pass a fake in tests to stay network-free. robots.txt directive parsing is
provided by `robots-parser`; sitemap parsing by `fast-xml-parser`.
