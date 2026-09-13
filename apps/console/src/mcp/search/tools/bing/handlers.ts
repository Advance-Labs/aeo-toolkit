/**
 * Bing Webmaster tool handlers. Each takes a ToolContext plus validated args and
 * returns an MCP ToolResult. They orchestrate the injected `@advance-labs/bing-api`
 * client and perform no I/O of their own, so they unit-test with a mocked factory.
 *
 * Both position fields are passed through untouched. Deciding which one is
 * comparable to GSC's single `position` is the cross-engine layer's job, and doing
 * it here would bake the choice in where no caller can see it.
 */
import { McpToolError } from '@advance-labs/mcp-core';
import type { ToolResult } from '@advance-labs/mcp-core';

import { bingFor, type ToolContext } from '../context.js';
import { jsonResult } from '../gsc/format.js';
import type {
  BingIndexHealthInput,
  BingKeywordResearchInput,
  BingQueryPagesInput,
  BingSiteInput,
} from './schemas.js';

/** `list_bing_sites()` — sites the resolved API key can access. */
export async function listBingSites(ctx: ToolContext): Promise<ToolResult> {
  const bing = await bingFor(ctx);
  const sites = await bing.listSites();
  return jsonResult(`Found ${sites.length} Bing Webmaster sites.`, { sites });
}

/** `bing_traffic_stats({ siteUrl, limit })` — the daily clicks/impressions series. */
export async function bingTrafficStats(
  ctx: ToolContext,
  input: BingSiteInput,
): Promise<ToolResult> {
  const bing = await bingFor(ctx);
  const series = await bing.getRankAndTrafficStats(input.siteUrl);
  const totals = series.reduce(
    (acc, point) => ({
      clicks: acc.clicks + point.clicks,
      impressions: acc.impressions + point.impressions,
    }),
    { clicks: 0, impressions: 0 },
  );
  const rows = series.slice(-input.limit);
  return jsonResult(
    `Bing traffic for ${input.siteUrl}: ${totals.clicks} clicks, ` +
      `${totals.impressions} impressions across ${series.length} days.`,
    { siteUrl: input.siteUrl, totals, days: series.length, series: rows },
  );
}

/** `bing_top_queries({ siteUrl, limit })`. */
export async function bingTopQueries(
  ctx: ToolContext,
  input: BingSiteInput,
): Promise<ToolResult> {
  const bing = await bingFor(ctx);
  const all = await bing.getQueryStats(input.siteUrl);
  const queries = [...all].sort((a, b) => b.clicks - a.clicks).slice(0, input.limit);
  return jsonResult(
    `Top ${queries.length} Bing queries for ${input.siteUrl} (of ${all.length}).`,
    { siteUrl: input.siteUrl, total: all.length, queries },
  );
}

/** `bing_top_pages({ siteUrl, limit })`. */
export async function bingTopPages(
  ctx: ToolContext,
  input: BingSiteInput,
): Promise<ToolResult> {
  const bing = await bingFor(ctx);
  const all = await bing.getPageStats(input.siteUrl);
  const pages = [...all].sort((a, b) => b.clicks - a.clicks).slice(0, input.limit);
  return jsonResult(
    `Top ${pages.length} Bing pages for ${input.siteUrl} (of ${all.length}).`,
    { siteUrl: input.siteUrl, total: all.length, pages },
  );
}

/**
 * `bing_query_pages({ siteUrl, query? | page? })` — the query-to-page pairing.
 *
 * Bing exposes this as two methods rather than a `dimensions` array, so the tool
 * takes exactly one of `query` or `page` and reports which direction it ran. Zod
 * cannot express "exactly one of" across optional fields, so it is checked here.
 */
export async function bingQueryPages(
  ctx: ToolContext,
  input: BingQueryPagesInput,
): Promise<ToolResult> {
  const hasQuery = input.query !== undefined;
  const hasPage = input.page !== undefined;
  if (hasQuery === hasPage) {
    throw new McpToolError(
      'bing_query_pages needs exactly one of `query` or `page`: pass `query` to see the ' +
        'pages that served it, or `page` to see the queries it served.',
      'bing_query_pages_bad_input',
    );
  }

  const bing = await bingFor(ctx);

  if (hasQuery) {
    const pages = await bing.getQueryPageStats(input.siteUrl, input.query as string);
    return jsonResult(
      `${pages.length} Bing pages served "${input.query as string}" on ${input.siteUrl}.`,
      { siteUrl: input.siteUrl, direction: 'query_to_pages', query: input.query, pages },
    );
  }

  const queries = await bing.getPageQueryStats(input.siteUrl, input.page as string);
  return jsonResult(
    `${queries.length} Bing queries served by ${input.page as string}.`,
    { siteUrl: input.siteUrl, direction: 'page_to_queries', page: input.page, queries },
  );
}

/**
 * `bing_index_health({ siteUrl, url? })` — is Bing crawling and indexing this.
 *
 * Bundles the read-only submission quota alongside crawl health. A quota is not
 * strictly "health", but an agent should be able to see what remains before any
 * future write spec lets anything spend it.
 */
export async function bingIndexHealth(
  ctx: ToolContext,
  input: BingIndexHealthInput,
): Promise<ToolResult> {
  const bing = await bingFor(ctx);
  const [crawlStats, crawlIssues, quota] = await Promise.all([
    bing.getCrawlStats(input.siteUrl),
    bing.getCrawlIssues(input.siteUrl),
    bing.getUrlSubmissionQuota(input.siteUrl),
  ]);

  const urlInfo =
    input.url !== undefined ? await bing.getUrlInfo(input.siteUrl, input.url) : null;

  const latest = crawlStats.at(-1) ?? null;
  const summary =
    latest === null
      ? `No Bing crawl stats for ${input.siteUrl}.`
      : `Bing last crawled ${latest.crawledPages} pages for ${input.siteUrl}; ` +
        `${latest.inIndex} in index, ${latest.codes4xx} 4xx, ${latest.codes5xx} 5xx.`;

  return jsonResult(summary, {
    siteUrl: input.siteUrl,
    latest,
    crawlStats,
    crawlIssues,
    quota,
    urlInfo,
  });
}

/**
 * `bing_keyword_research({ query, country?, language? })`.
 *
 * The tool with no Google equivalent: Search Console does not expose keyword
 * impression data at all. Seed stats and related keywords are merged and
 * deduplicated by query, seed first.
 */
export async function bingKeywordResearch(
  ctx: ToolContext,
  input: BingKeywordResearchInput,
): Promise<ToolResult> {
  const bing = await bingFor(ctx);
  const [seed, related] = await Promise.all([
    bing.getKeywordStats(input.query, input.country, input.language),
    bing.getRelatedKeywords(input.query, input.country, input.language),
  ]);

  const byQuery = new Map<string, (typeof seed)[number]>();
  for (const row of [...seed, ...related]) {
    if (!byQuery.has(row.query)) byQuery.set(row.query, row);
  }
  const keywords = [...byQuery.values()];

  return jsonResult(
    `${keywords.length} Bing keywords around "${input.query}" ` +
      '(Search Console exposes no equivalent data).',
    { seedQuery: input.query, keywords },
  );
}
