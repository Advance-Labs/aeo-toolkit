/**
 * The E-E-A-T audit pipeline: Crawl → Parse → Detect → Score.
 *
 * This is the real, runnable core flow. It reuses the shared engines exactly as
 * the architecture intends:
 *   1. `@aeo/crawler.crawl` discovers up to `maxPages` pages over real HTTP.
 *   2. `@aeo/html-parser.parseHtml` extracts the `ParsedHtml` shape per page.
 *   3. `@aeo/schema-validator.analyzeStructuredData` builds a `StructuredDataReport` per page.
 *   4. The three are assembled into a `ScoringContext` and handed to
 *      `@aeo/scoring.eeatScore`, which returns the four-pillar `EeatReport`.
 *
 * The single external-I/O seam is the injectable `Crawler` interface below. In
 * production it is the real network-backed `@aeo/crawler.crawl`; tests inject a
 * fake so the whole pipeline runs without any live network.
 */
import { crawl } from '@aeo/crawler';
import { parseHtml } from '@aeo/html-parser';
import { analyzeStructuredData } from '@aeo/schema-validator';
import { eeatScore } from '@aeo/scoring';
import type {
  CrawlResult,
  EeatReport,
  ParsedHtml,
  ScoringContext,
  StructuredDataReport,
} from '@aeo/types';

/** Hard page cap for an E-E-A-T scan (per the tool spec). */
export const EEAT_MAX_PAGES = 12;

/**
 * The injectable crawl seam. The real implementation hits the network via
 * `@aeo/crawler`; tests provide a deterministic fake. Keeping this as a typed
 * interface means the surrounding pipeline is fully exercised either way.
 */
export interface Crawler {
  (rootUrl: string, opts: { maxPages: number }): Promise<CrawlResult>;
}

// STUB-SEAM: live HTTP crawling. Not a stub of business logic — it is the real
// `@aeo/crawler.crawl` with E-E-A-T-appropriate defaults. Tests swap it out so
// no network is required to run the pipeline.
const defaultCrawler: Crawler = (rootUrl, opts) =>
  crawl(rootUrl, {
    maxPages: opts.maxPages,
    respectRobotsTxt: true,
    followSitemap: true,
    perHostRateLimitMs: 500,
    concurrency: 4,
  });

export interface RunEeatAuditOptions {
  /** Page cap for this run. Defaults to {@link EEAT_MAX_PAGES}. */
  maxPages?: number;
  /** Injectable crawler for tests / alternative transports. */
  crawler?: Crawler;
}

/**
 * Run the end-to-end E-E-A-T audit for a URL and return the `EeatReport`.
 *
 * Only successful HTML responses with a body are parsed; everything else is
 * skipped so a single 404 or binary asset never poisons the score.
 */
export async function runEeatAudit(
  url: string,
  options: RunEeatAuditOptions = {},
): Promise<EeatReport> {
  const maxPages = options.maxPages ?? EEAT_MAX_PAGES;
  const crawler = options.crawler ?? defaultCrawler;

  const crawlResult = await crawler(url, { maxPages });

  const pages: ParsedHtml[] = [];
  const structuredData: StructuredDataReport[] = [];

  for (const page of crawlResult.pages) {
    if (!page.ok || typeof page.body !== 'string' || page.body.length === 0) continue;
    if (!isHtmlContentType(page.contentType)) continue;

    const target = page.finalUrl || page.url;
    pages.push(parseHtml(page.body, target));
    structuredData.push(analyzeStructuredData(page.body, target));
  }

  const ctx: ScoringContext = {
    crawl: crawlResult,
    pages,
    structuredData,
    mode: pages.length <= 1 ? 'single-page' : 'full-site',
  };

  return eeatScore(ctx);
}

/** Permissive HTML content-type check (mirrors the crawler's own predicate). */
function isHtmlContentType(contentType: string | undefined): boolean {
  if (!contentType) return true; // be permissive when the server omits it
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}
