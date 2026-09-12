/**
 * GA4 + GSC MCP tool registry + runtime wiring.
 *
 * `registerGaGscTools(server, ctx)` binds every tool's zod schema + handler onto
 * an `McpServer` (the object `mcp-handler`'s `createMcpHandler` setup callback
 * gives us) via `@advance-labs/mcp-core#registerTool`. The `ctx` carries the request-scoped
 * BYOK bearer token, so the route builds a fresh server per request.
 *
 * `buildGaGscRuntime()` assembles the process-shared store + token resolver from
 * the environment (Supabase-backed when configured, in-memory otherwise). The
 * service-role key and any tokens are read only here and never logged.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '@advance-labs/mcp-core';
import type { TokenStore } from '@advance-labs/types';

import { loadConfig, type ServerConfig } from './config.js';
import { BingKeyResolver, InMemoryBingKeyStore } from './auth/bing.js';
import {
  createDefaultTokenResolver,
  createTokenStore,
  DEFAULT_USER_ID,
  type TokenResolver,
} from './auth/google.js';
import { defaultClientFactory, type ToolContext } from './tools/context.js';
import {
  comparePeriodsShape,
  emptyShape,
  ga4RunReportShape,
  gscCtrGapsShape,
  gscSearchAnalyticsShape,
  gscTopQueriesShape,
  gscTrafficDropShape,
  gscCannibalizationShape,
  gscDecayShape,
} from './tools/gsc/schemas.js';
import {
  comparePeriodsTool,
  ga4RunReport,
  gscCtrGaps,
  gscSearchAnalytics,
  gscTopQueries,
  listGa4Properties,
  listGscSites,
  gscTrafficDrop,
  gscCannibalization,
  gscDecay,
} from './tools/gsc/handlers.js';
import {
  bingIndexHealthShape,
  bingKeywordResearchShape,
  bingQueryPagesShape,
  bingSiteShape,
  listBingSitesShape,
} from './tools/bing/schemas.js';
import {
  bingIndexHealth,
  bingKeywordResearch,
  bingQueryPages,
  bingTopPages,
  bingTopQueries,
  bingTrafficStats,
  listBingSites,
} from './tools/bing/handlers.js';
import { compareEnginesShape, engineDivergenceShape } from './tools/cross/schemas.js';
import { compareEngines, engineDivergence } from './tools/cross/handlers.js';

export type { ToolContext } from './tools/context.js';
export { defaultClientFactory } from './tools/context.js';

/**
 * Register all nineteen tools onto `server`. The `ctx` is captured per
 * registration; the HTTP route builds a fresh `ctx` (with the request-scoped
 * bearer token and Bing API key) per request and re-registers onto a
 * per-request server instance.
 */
export function registerSearchTools(server: McpServer, ctx: ToolContext): void {
  registerTool(server, {
    name: 'list_ga4_properties',
    title: 'List GA4 properties',
    description:
      'List the Google Analytics 4 properties the connected account can access. ' +
      'Returns {propertyId, displayName}[]. (GA4 Admin listing is currently stubbed upstream.)',
    inputSchema: emptyShape,
    handler: () => listGa4Properties(ctx),
  });

  registerTool(server, {
    name: 'list_gsc_sites',
    title: 'List Search Console sites',
    description:
      'List the Google Search Console properties (sites) the connected account can access. ' +
      'Returns {siteUrl, permissionLevel}[].',
    inputSchema: emptyShape,
    handler: () => listGscSites(ctx),
  });

  registerTool(server, {
    name: 'ga4_run_report',
    title: 'Run a GA4 report',
    description:
      'Run a Google Analytics 4 report. Provide a propertyId, one or more date ranges, ' +
      'GA4 dimension names (e.g. date, pagePath) and metric names (e.g. screenPageViews, ' +
      'totalUsers). Returns named rows of {dimensions, metrics}.',
    inputSchema: ga4RunReportShape,
    handler: (input) => ga4RunReport(ctx, input),
  });

  registerTool(server, {
    name: 'gsc_search_analytics',
    title: 'Query GSC search analytics',
    description:
      'Query Google Search Console Search Analytics for a site over a date range, optionally ' +
      'broken down by dimensions (query, page, country, device, date, searchAppearance). ' +
      'Returns rows of {keys, clicks, impressions, ctr, position}.',
    inputSchema: gscSearchAnalyticsShape,
    handler: (input) => gscSearchAnalytics(ctx, input),
  });

  registerTool(server, {
    name: 'gsc_top_queries',
    title: 'Top GSC queries',
    description:
      'Convenience tool: the top search queries for a site over the last N days, ranked by ' +
      'clicks. Returns {query, clicks, impressions, ctr, position}[].',
    inputSchema: gscTopQueriesShape,
    handler: (input) => gscTopQueries(ctx, input),
  });

  registerTool(server, {
    name: 'gsc_ctr_gaps',
    title: 'GSC CTR gaps',
    description:
      'Find click-through-rate opportunities: high-impression, low-CTR queries over the last ' +
      'N days — pages people see in search but rarely click. Prime targets for title/meta ' +
      'rewrites. Returns the gap rows ranked by impressions.',
    inputSchema: gscCtrGapsShape,
    handler: (input) => gscCtrGaps(ctx, input),
  });

  registerTool(server, {
    name: 'compare_periods',
    title: 'Compare two GSC periods',
    description:
      'Compare aggregate Search Console performance between two date ranges (rangeA vs rangeB) ' +
      'for a site. Returns totals for each period plus per-metric deltas (clicks, impressions, ' +
      'CTR, weighted position) with absolute and relative change.',
    inputSchema: comparePeriodsShape,
    handler: (input) => comparePeriodsTool(ctx, input),
  });

  registerTool(server, {
    name: 'gsc_traffic_drop',
    title: 'Diagnose a traffic drop',
    description:
      'Explain WHY traffic changed between two periods, not just whether it did. Attributes the ' +
      'click change to individual pages (or queries) and ranks them by how much of the decline ' +
      'each accounts for, with before/after clicks, impressions and position. Reports gains and ' +
      'losses separately, so a flat net change cannot hide one page collapsing while another ' +
      'grows. Use this when someone asks what caused a drop.',
    inputSchema: gscTrafficDropShape,
    handler: (input) => gscTrafficDrop(ctx, input),
  });

  registerTool(server, {
    name: 'gsc_cannibalization',
    title: 'Find keyword cannibalization',
    description:
      "Find queries that two or more of the site's own pages compete for, splitting clicks " +
      'between them. Returns each competing page with its clicks, impressions, CTR and position, ' +
      'plus the best-RANKING page as the natural consolidation target (not merely the one with ' +
      'the most clicks). Overlap is reported as evidence, not as a fault.',
    inputSchema: gscCannibalizationShape,
    handler: (input) => gscCannibalization(ctx, input),
  });

  registerTool(server, {
    name: 'gsc_decay',
    title: 'Detect decaying content',
    description:
      'Catch pages bleeding traffic before they fall off page one. Compares a recent window ' +
      'against the equal-length window immediately before it and returns pages whose clicks ' +
      'fell past a threshold, flagging whether each also LOST RANK — clicks down at flat rank ' +
      'suggests seasonality or a SERP change, while clicks down with rank suggests competitors. ' +
      'Search Console cannot rule out seasonality on its own.',
    inputSchema: gscDecayShape,
    handler: (input) => gscDecay(ctx, input),
  });

  registerTool(server, {
    name: 'list_bing_sites',
    title: 'List Bing Webmaster sites',
    description:
      'List the Bing Webmaster Tools sites the resolved API key can access. ' +
      'Returns {siteUrl, ...}[]. Read-only.',
    inputSchema: listBingSitesShape,
    handler: () => listBingSites(ctx),
  });

  registerTool(server, {
    name: 'bing_traffic_stats',
    title: 'Bing traffic stats',
    description:
      'Daily clicks/impressions series for a Bing Webmaster site, with totals across the ' +
      'series. Returns the most recent `limit` days.',
    inputSchema: bingSiteShape,
    handler: (input) => bingTrafficStats(ctx, input),
  });

  registerTool(server, {
    name: 'bing_top_queries',
    title: 'Top Bing queries',
    description:
      'The top search queries for a Bing Webmaster site, ranked by clicks. ' +
      'Returns {query, clicks, impressions, ...}[].',
    inputSchema: bingSiteShape,
    handler: (input) => bingTopQueries(ctx, input),
  });

  registerTool(server, {
    name: 'bing_top_pages',
    title: 'Top Bing pages',
    description:
      'The top pages for a Bing Webmaster site, ranked by clicks. ' +
      'Returns {page, clicks, impressions, ...}[].',
    inputSchema: bingSiteShape,
    handler: (input) => bingTopPages(ctx, input),
  });

  registerTool(server, {
    name: 'bing_query_pages',
    title: 'Bing query/page pairing',
    description:
      'The query-to-page pairing on Bing: pass `query` to see the pages that served it, or ' +
      '`page` to see the queries it served. Bing exposes this as two methods rather than a ' +
      'single dimensions array, so exactly one of `query`/`page` is required.',
    inputSchema: bingQueryPagesShape,
    handler: (input) => bingQueryPages(ctx, input),
  });

  registerTool(server, {
    name: 'bing_index_health',
    title: 'Bing index health',
    description:
      'Is Bing crawling and indexing this site: crawl stats, crawl issues, the URL ' +
      'submission quota, and (with `url`) single-URL index status. Read-only.',
    inputSchema: bingIndexHealthShape,
    handler: (input) => bingIndexHealth(ctx, input),
  });

  registerTool(server, {
    name: 'bing_keyword_research',
    title: 'Bing keyword research',
    description:
      'Keyword impression and broad-match volume around a seed term, from Bing Webmaster. ' +
      'Google Search Console exposes no equivalent data, so this is available for Bing only.',
    inputSchema: bingKeywordResearchShape,
    handler: (args) => bingKeywordResearch(ctx, args),
  });

  registerTool(server, {
    name: 'compare_engines',
    title: 'Compare Google and Bing side by side',
    description:
      'Query rows from Google Search Console and Bing Webmaster for the same site and date ' +
      'range, merged by query with an explicit coverage block reporting whether each engine ' +
      'answered. A missing engine reports its reason rather than a zeroed row.',
    inputSchema: compareEnginesShape,
    handler: (input) => compareEngines(ctx, input),
  });

  registerTool(server, {
    name: 'engine_divergence',
    title: 'Classify where Google and Bing disagree',
    description:
      'Split a date range in half and classify each query by how it moved on each engine: ' +
      'google_specific (held on Bing, dropped on Google — suspect Google ranking), ' +
      'bing_specific, broad (dropped on both — suspect the content), or insufficient_data. ' +
      'Google is windowed server-side; Bing is fetched once and bucketed locally by row ' +
      'date. An engine that could not answer yields insufficient_data, never a zero.',
    inputSchema: engineDivergenceShape,
    handler: (input) => engineDivergence(ctx, input),
  });
}

/** Compat alias: the server was named for GA4+GSC before Bing joined it. */
export { registerSearchTools as registerGaGscTools };

/** Process-shared runtime: config + token store + resolver (store survives the process). */
export interface GaGscRuntime {
  config: ServerConfig;
  store: TokenStore;
  tokens: TokenResolver;
  bingKeys: BingKeyResolver;
}

/** Build the shared runtime (store + resolver) from the environment, once per process. */
export function buildGaGscRuntime(env: NodeJS.ProcessEnv = process.env): GaGscRuntime {
  const config = loadConfig(env);
  // Env-gated: Supabase-backed (durable, multi-instance) when configured, else in-memory.
  const store = createTokenStore(config.supabase);
  const tokens = createDefaultTokenResolver({
    oauthEnv: config.oauth,
    staticAccessToken: config.staticAccessToken,
    store,
  });
  // Single-instance / local-dev only, mirroring `store`'s in-memory fallback above.
  const bingKeys = new BingKeyResolver({
    store: new InMemoryBingKeyStore(),
    staticApiKey: config.bing.apiKey,
  });
  return { config, store, tokens, bingKeys };
}

/**
 * Build a per-request {@link ToolContext} from the shared runtime and the
 * request's BYOK bearer token and Bing API key (both take precedence over any
 * stored credential and are never persisted). `userId` names the stored Google
 * connection to resolve when there is no BYOK token: an OAuth caller's own id
 * (see `@/mcp/oauth/gate`), else the shared `default` slot.
 */
export function buildGaGscContext(
  runtime: GaGscRuntime,
  requestToken: string | null,
  requestBingKey: string | null,
  userId: string = DEFAULT_USER_ID,
): ToolContext {
  return {
    tokens: runtime.tokens,
    bingKeys: runtime.bingKeys,
    clients: defaultClientFactory,
    userId,
    requestToken,
    requestBingKey,
  };
}
