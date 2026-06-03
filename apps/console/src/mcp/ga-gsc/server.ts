/**
 * GA4 + GSC MCP tool registry + runtime wiring.
 *
 * `registerGaGscTools(server, ctx)` binds every tool's zod schema + handler onto
 * an `McpServer` (the object `mcp-handler`'s `createMcpHandler` setup callback
 * gives us) via `@aeo/mcp-core#registerTool`. The `ctx` carries the request-scoped
 * BYOK bearer token, so the route builds a fresh server per request.
 *
 * `buildGaGscRuntime()` assembles the process-shared store + token resolver from
 * the environment (Supabase-backed when configured, in-memory otherwise). The
 * service-role key and any tokens are read only here and never logged.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '@aeo/mcp-core';
import type { TokenStore } from '@aeo/types';

import { loadConfig, type ServerConfig } from './config.js';
import {
  createDefaultTokenResolver,
  createTokenStore,
  DEFAULT_USER_ID,
  type TokenResolver,
} from './auth.js';
import { defaultClientFactory, type ToolContext } from './tools/context.js';
import {
  comparePeriodsShape,
  emptyShape,
  ga4RunReportShape,
  gscCtrGapsShape,
  gscSearchAnalyticsShape,
  gscTopQueriesShape,
} from './tools/schemas.js';
import {
  comparePeriodsTool,
  ga4RunReport,
  gscCtrGaps,
  gscSearchAnalytics,
  gscTopQueries,
  listGa4Properties,
  listGscSites,
} from './tools/handlers.js';

export type { ToolContext } from './tools/context.js';
export { defaultClientFactory } from './tools/context.js';

/**
 * Register all seven tools onto `server`. The `ctx` is captured per registration;
 * the HTTP route builds a fresh `ctx` (with the request-scoped bearer token) per
 * request and re-registers onto a per-request server instance.
 */
export function registerGaGscTools(server: McpServer, ctx: ToolContext): void {
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
}

/** Process-shared runtime: config + token store + resolver (store survives the process). */
export interface GaGscRuntime {
  config: ServerConfig;
  store: TokenStore;
  tokens: TokenResolver;
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
  return { config, store, tokens };
}

/**
 * Build a per-request {@link ToolContext} from the shared runtime and the
 * request's BYOK bearer token (which takes precedence over any stored token and
 * is never persisted).
 */
export function buildGaGscContext(runtime: GaGscRuntime, requestToken: string | null): ToolContext {
  return {
    tokens: runtime.tokens,
    clients: defaultClientFactory,
    userId: DEFAULT_USER_ID,
    requestToken,
  };
}
