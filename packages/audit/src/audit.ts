import { promises as dns } from 'node:dns';
import { crawl, type Fetcher } from '@advance-labs/crawler';
import { isBlockedAddress } from '@advance-labs/net-guard';
import { buildAuditReport } from '@advance-labs/scoring';
import type { AuditReport, CrawledPage } from '@advance-labs/types';

export const VERSION = '0.0.0';

/**
 * Fetcher that refuses private, loopback, link-local and metadata addresses. The crawler follows
 * redirects itself (one fetcher call per hop), so every hop is checked, not just the first.
 */
export const guardedFetcher: Fetcher = async (url, init) => {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'http:' && protocol !== 'https:') throw new Error(`blocked scheme ${protocol}`);
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0 || records.some((r) => isBlockedAddress(r.address))) {
    throw new Error(`blocked private or unresolvable address for ${hostname}`);
  }
  return fetch(url, init);
};

const isHtml = (p: CrawledPage): boolean => p.ok && /html/i.test(p.contentType ?? '') && !!p.body;

export async function runAudit(url: string, pages: number): Promise<AuditReport> {
  const started = Date.now();
  const result = await crawl(url, { maxPages: pages, fetcher: guardedFetcher });
  const html = result.pages.filter(isHtml);
  if (html.length === 0) {
    const root = result.pages[0];
    throw new Error(
      `Could not fetch ${url}` + (root?.status ? ` (HTTP ${root.status}, not HTML)` : ` (${root?.error ?? 'no response'})`),
    );
  }
  // Loaded only now, after all fetching: html-parser and schema-validator pull in cheerio, whose
  // bundled undici replaces the global fetch dispatcher on import. On Node 26 that breaks the
  // built-in fetch (empty headers, undecoded bodies). ponytail: drop once cheerio stops doing this.
  const { parseHtml } = await import('@advance-labs/html-parser');
  const { analyzeStructuredData } = await import('@advance-labs/schema-validator');
  const ctx = {
    crawl: result,
    pages: html.map((p) => parseHtml(p.body ?? '', p.finalUrl)),
    structuredData: html.map((p) => analyzeStructuredData(p.body ?? '', p.finalUrl)),
    mode: html.length > 1 ? ('full-site' as const) : ('single-page' as const),
  };
  return buildAuditReport(ctx, { durationMs: Date.now() - started, version: VERSION, crawler: 'aeo-audit-cli' });
}
