/**
 * audit-site.mjs — the shared "audit one live site" pipeline, factored out so both the single-site
 * report (seo-audit.mjs) and the batch scorecard runner (seo-audit-batch.mjs) drive the same engine:
 * crawl -> parse -> structured-data -> score. The only I/O here is the network crawl; everything
 * downstream is pure scoring, so callers decide how to render the resulting `AuditReport`.
 */
import { crawl } from "@advance-labs/crawler";
import { parseHtml } from "@advance-labs/html-parser";
import { analyzeStructuredData } from "@advance-labs/schema-validator";
import { buildAuditReport } from "@advance-labs/scoring";

export const ENGINE_VERSION = "0.1.0";

/** A page is worth parsing only if the crawl succeeded and the body is HTML. */
function isParseable(page) {
  if (!page.ok || typeof page.body !== "string" || page.body.length === 0) return false;
  const ct = page.contentType;
  return ct === undefined || /text\/html|application\/xhtml\+xml/i.test(ct);
}

/**
 * Crawl `site`, score it, and resolve to a fully-built `AuditReport`.
 *
 * @param {string} site - Origin URL to audit (e.g. "https://example.com").
 * @param {{ max?: number, version?: string }} [opts]
 * @returns {Promise<import("@advance-labs/types").AuditReport>}
 * @throws if the crawler reaches zero pages (site unreachable / blocking the crawler).
 */
export async function auditSite(site, { max = 25, version = ENGINE_VERSION } = {}) {
  const startedAt = Date.now();
  const crawlResult = await crawl(site, {
    maxPages: max,
    respectRobotsTxt: true,
    followSitemap: true,
    userAgent: `@advance-labs/seo-audit/${version}`,
  });

  if (crawlResult.pageCount === 0) {
    throw new Error(`No pages crawled — ${site} unreachable or blocking the crawler.`);
  }

  const pages = [];
  const structuredData = [];
  for (const page of crawlResult.pages) {
    if (!isParseable(page)) continue;
    pages.push(parseHtml(page.body, page.finalUrl));
    structuredData.push(analyzeStructuredData(page.body, page.finalUrl));
  }

  const ctx = { crawl: crawlResult, pages, structuredData, mode: "full-site" };
  return buildAuditReport(ctx, { durationMs: Date.now() - startedAt, version });
}
