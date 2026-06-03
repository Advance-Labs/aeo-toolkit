/**
 * The audit pipeline: crawl -> parse -> detect structured data -> assemble a
 * ScoringContext -> build the AuditReport. Kept free of Next.js so it is a pure,
 * unit-testable function. The single I/O seam (the crawl) is injectable via
 * `deps.crawl`, so tests run with a mocked crawler and zero network.
 */
import { crawl as defaultCrawl } from '@aeo/crawler';
import { parseHtml } from '@aeo/html-parser';
import { analyzeStructuredData } from '@aeo/schema-validator';
import { buildAuditReport } from '@aeo/scoring';
import type {
  AuditReport,
  CrawledPage,
  CrawlResult,
  ParsedHtml,
  ScoringContext,
  StructuredDataReport,
} from '@aeo/types';
import { AuditError } from './errors.js';

/** Identifier surfaced in report metadata and used as the crawl user-agent label. */
export const AUDIT_VERSION = '0.1.0';

/** The crawl seam: same shape as `@aeo/crawler#crawl`, injectable for tests. */
export type CrawlFn = typeof defaultCrawl;

export interface RunAuditDeps {
  /** Defaults to `@aeo/crawler#crawl`; tests inject a fake so no network is hit. */
  crawl?: CrawlFn;
  /** Injectable clock for deterministic duration measurement in tests. */
  now?: () => number;
}

export interface RunAuditOptions {
  url: string;
  maxPages: number;
}

/**
 * A page is parseable when the crawl fetched HTML successfully and captured a body.
 * Non-HTML assets, redirects-only, and error responses are excluded from parsing
 * (they still count toward `pagesCrawled` via the crawl result).
 */
function isParseablePage(page: CrawledPage): page is CrawledPage & { body: string } {
  if (!page.ok || typeof page.body !== 'string' || page.body.length === 0) return false;
  const ct = page.contentType;
  // Be permissive when content-type is omitted; otherwise require an HTML-ish type.
  return ct === undefined || /text\/html|application\/xhtml\+xml/i.test(ct);
}

/** Parse + structured-data analysis for every HTML page in the crawl. */
export function analyzeCrawledPages(crawlResult: CrawlResult): {
  pages: ParsedHtml[];
  structuredData: StructuredDataReport[];
} {
  const pages: ParsedHtml[] = [];
  const structuredData: StructuredDataReport[] = [];

  for (const page of crawlResult.pages) {
    if (!isParseablePage(page)) continue;
    // Parse and structured-data are keyed to the page's final (post-redirect) URL.
    pages.push(parseHtml(page.body, page.finalUrl));
    structuredData.push(analyzeStructuredData(page.body, page.finalUrl));
  }

  return { pages, structuredData };
}

/**
 * Run the full audit. Returns a fully-computed {@link AuditReport}. Throws a typed
 * {@link AuditError} on crawl failure or when no pages could be crawled — callers
 * (the route handler) translate that into a structured non-2xx JSON response.
 */
export async function runAudit(
  options: RunAuditOptions,
  deps: RunAuditDeps = {},
): Promise<AuditReport> {
  const crawl = deps.crawl ?? defaultCrawl;
  const now = deps.now ?? Date.now;
  const startedAt = now();

  let crawlResult: CrawlResult;
  try {
    crawlResult = await crawl(options.url, {
      maxPages: options.maxPages,
      respectRobotsTxt: true,
      followSitemap: true,
      userAgent: `@aeo/llm-audit/${AUDIT_VERSION}`,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown crawl error';
    throw new AuditError('crawl_failed', `Failed to crawl ${options.url}: ${reason}`, 502);
  }

  if (crawlResult.pageCount === 0) {
    throw new AuditError(
      'no_pages',
      `Crawl of ${options.url} returned no pages. The site may be unreachable or blocking the crawler.`,
      422,
    );
  }

  const { pages, structuredData } = analyzeCrawledPages(crawlResult);

  const ctx: ScoringContext = {
    crawl: crawlResult,
    pages,
    structuredData,
    mode: 'full-site',
  };

  const durationMs = Math.max(0, now() - startedAt);
  return buildAuditReport(ctx, { durationMs, version: AUDIT_VERSION });
}
