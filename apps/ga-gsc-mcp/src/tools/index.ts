/**
 * The tool registry: binds every GA4/GSC tool's zod schema + handler onto a
 * `CreatedServer` via `@aeo/mcp-core`'s `registerTool`. Both transports
 * (`server.ts` stdio, `http.ts` HTTP/SSE) call {@link registerAllTools} so the two
 * entrypoints expose an identical tool surface.
 */
import { registerTool, type CreatedServer } from '@aeo/mcp-core';

import type { ToolContext } from './context.js';
import {
  comparePeriodsShape,
  emptyShape,
  ga4RunReportShape,
  gscCtrGapsShape,
  gscSearchAnalyticsShape,
  gscTopQueriesShape,
} from './schemas.js';
import {
  comparePeriodsTool,
  ga4RunReport,
  gscCtrGaps,
  gscSearchAnalytics,
  gscTopQueries,
  listGa4Properties,
  listGscSites,
} from './handlers.js';

export type { ToolContext } from './context.js';
export {
  baseContext,
  defaultClientFactory,
  type ClientFactory,
  type Ga4Like,
  type GscLike,
} from './context.js';

/**
 * Register all seven tools. The `ctx` is captured per registration; for the HTTP
 * transport a fresh context (with the request-scoped bearer token) is built per
 * request and the tools are re-registered onto a per-request server instance.
 */
export function registerAllTools(target: CreatedServer, ctx: ToolContext): void {
  registerTool(target, {
    name: 'list_ga4_properties',
    title: 'List GA4 properties',
    description:
      'List the Google Analytics 4 properties the connected account can access. ' +
      'Returns {propertyId, displayName}[]. (GA4 Admin listing is currently stubbed upstream.)',
    inputSchema: emptyShape,
    handler: () => listGa4Properties(ctx),
  });

  registerTool(target, {
    name: 'list_gsc_sites',
    title: 'List Search Console sites',
    description:
      'List the Google Search Console properties (sites) the connected account can access. ' +
      'Returns {siteUrl, permissionLevel}[].',
    inputSchema: emptyShape,
    handler: () => listGscSites(ctx),
  });

  registerTool(target, {
    name: 'ga4_run_report',
    title: 'Run a GA4 report',
    description:
      'Run a Google Analytics 4 report. Provide a propertyId, one or more date ranges, ' +
      'GA4 dimension names (e.g. date, pagePath) and metric names (e.g. screenPageViews, ' +
      'totalUsers). Returns named rows of {dimensions, metrics}.',
    inputSchema: ga4RunReportShape,
    handler: (input) => ga4RunReport(ctx, input),
  });

  registerTool(target, {
    name: 'gsc_search_analytics',
    title: 'Query GSC search analytics',
    description:
      'Query Google Search Console Search Analytics for a site over a date range, optionally ' +
      'broken down by dimensions (query, page, country, device, date, searchAppearance). ' +
      'Returns rows of {keys, clicks, impressions, ctr, position}.',
    inputSchema: gscSearchAnalyticsShape,
    handler: (input) => gscSearchAnalytics(ctx, input),
  });

  registerTool(target, {
    name: 'gsc_top_queries',
    title: 'Top GSC queries',
    description:
      'Convenience tool: the top search queries for a site over the last N days, ranked by ' +
      'clicks. Returns {query, clicks, impressions, ctr, position}[].',
    inputSchema: gscTopQueriesShape,
    handler: (input) => gscTopQueries(ctx, input),
  });

  registerTool(target, {
    name: 'gsc_ctr_gaps',
    title: 'GSC CTR gaps',
    description:
      'Find click-through-rate opportunities: high-impression, low-CTR queries over the last ' +
      'N days — pages people see in search but rarely click. Prime targets for title/meta ' +
      'rewrites. Returns the gap rows ranked by impressions.',
    inputSchema: gscCtrGapsShape,
    handler: (input) => gscCtrGaps(ctx, input),
  });

  registerTool(target, {
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
