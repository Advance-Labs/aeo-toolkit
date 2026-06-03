/**
 * The client-side audit pipeline.
 *
 * DOM html + same-origin site files ──▶ ScoringContext (mode: 'single-page')
 *                                   ──▶ @aeo/scoring buildAuditReport ──▶ AuditPayload
 *
 * Everything here is pure given its inputs: `parseHtml`, `analyzeStructuredData`,
 * and `buildAuditReport` are all dependency-free, and the only I/O (site files)
 * is injected as already-fetched values. This makes the whole audit unit-testable.
 */
import { parseHtml } from '@aeo/html-parser';
import { analyzeStructuredData } from '@aeo/schema-validator';
import { buildAuditReport } from '@aeo/scoring';
import type {
  CrawledPage,
  CrawlResult,
  ParsedHtml,
  RobotsTxt,
  ScoringContext,
  SiteFilePresence,
  StructuredDataReport,
} from '@aeo/types';

import { parseRobotsTxt } from './robots.js';
import { parseSitemap } from './sitemap.js';
import type { SiteFiles } from './site-files.js';
import type { AuditPayload, CheckRow } from './types.js';

/** Toolkit version surfaced in report metadata. */
const EXTENSION_VERSION = '0.1.0';

export interface BuildContextInput {
  /** The live page URL (active tab). */
  pageUrl: string;
  /** Serialized live DOM (`document.documentElement.outerHTML`). */
  html: string;
  /** Already-fetched same-origin crawl-hint files. */
  siteFiles: SiteFiles;
  /** When the audit started (ms epoch) — used for `durationMs`. */
  startedAtMs: number;
}

/** Origin (scheme + host) of a URL, or the raw input if it cannot be parsed. */
export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Assemble a synthetic single-page {@link ScoringContext}. The crawl has exactly
 * one page (the active tab) plus the origin's robots/sitemap/file-presence data,
 * so multi-page rules (e.g. title uniqueness) skip gracefully in single-page mode.
 */
export function buildSinglePageContext(input: BuildContextInput): {
  ctx: ScoringContext;
  parsed: ParsedHtml;
  structured: StructuredDataReport;
} {
  const { pageUrl, html, siteFiles } = input;
  const origin = originOf(pageUrl);

  const parsed = parseHtml(html, pageUrl);
  const structured = analyzeStructuredData(html, pageUrl);

  const robots: RobotsTxt = parseRobotsTxt(
    siteFiles.robotsTxt.body,
    `${origin.replace(/\/$/, '')}/robots.txt`,
  );

  const sitemap = parseSitemap(siteFiles.sitemapXml.body);

  const filePresence: SiteFilePresence = {
    robotsTxt: siteFiles.robotsTxt.exists,
    sitemapXml: siteFiles.sitemapXml.exists,
    llmsTxt: siteFiles.llmsTxt.exists,
    llmsFullTxt: siteFiles.llmsFullTxt.exists,
    favicon: siteFiles.favicon.exists,
  };

  const nowIso = new Date().toISOString();
  const page: CrawledPage = {
    url: pageUrl,
    finalUrl: pageUrl,
    status: 200,
    ok: true,
    contentType: 'text/html',
    headers: {},
    body: html,
    timingMs: 0,
    redirectChain: [],
    depth: 0,
  };

  const crawl: CrawlResult = {
    rootUrl: pageUrl,
    https: origin.startsWith('https:'),
    pages: [page],
    sitemap,
    robots,
    filePresence,
    startedAt: nowIso,
    finishedAt: nowIso,
    pageCount: 1,
  };

  const ctx: ScoringContext = {
    crawl,
    pages: [parsed],
    structuredData: [structured],
    mode: 'single-page',
  };

  return { ctx, parsed, structured };
}

/** Run the full client-side audit and produce the popup-facing payload. */
export async function runAudit(input: BuildContextInput): Promise<AuditPayload> {
  const { ctx } = buildSinglePageContext(input);
  const durationMs = Math.max(0, Date.now() - input.startedAtMs);

  const report = await buildAuditReport(ctx, {
    durationMs,
    version: EXTENSION_VERSION,
    crawler: 'aeo-chrome-extension',
  });

  return {
    pageUrl: input.pageUrl,
    origin: originOf(input.pageUrl),
    report,
    filePresence: ctx.crawl.filePresence,
    siteFiles: {
      robotsTxt: input.siteFiles.robotsTxt.body,
      sitemapXml: input.siteFiles.sitemapXml.body,
      llmsTxt: input.siteFiles.llmsTxt.body,
    },
  };
}

/**
 * Flatten every evaluated finding (passed + failed) across all categories into
 * the popup's checklist rows. Failed-first ordering is handled at render time.
 */
export function toCheckRows(payload: AuditPayload): CheckRow[] {
  const rows: CheckRow[] = [];
  for (const category of payload.report.score.categories) {
    for (const finding of category.findings) {
      rows.push({
        id: finding.id,
        category: category.label,
        title: finding.title,
        passed: finding.passed,
        severity: finding.severity,
        recommendation: finding.recommendation,
      });
    }
  }
  return rows;
}
