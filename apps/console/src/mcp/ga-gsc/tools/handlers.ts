/**
 * Tool handler implementations. Each takes a {@link ToolContext} + validated args
 * and returns an MCP `ToolResult`. They orchestrate the `@aeo/google-api` clients
 * and the pure transforms in `analytics.ts` / `dates.ts`; they perform no I/O of
 * their own beyond the injected clients, so they unit-test with a mocked factory.
 */
import type { ToolResult } from '@aeo/mcp-core';
import type { DateRange } from '@aeo/types';

import { ga4For, gscFor, type ToolContext } from './context.js';
import { jsonResult, pct } from './format.js';
import { lastNDays } from './dates.js';
import {
  aggregate,
  comparePeriods,
  DEFAULT_CTR_GAP_OPTIONS,
  findCtrGaps,
  toQueryStats,
  topQueriesByClicks,
} from './analytics.js';
import type {
  ComparePeriodsInput,
  Ga4RunReportInput,
  GscCtrGapsInput,
  GscSearchAnalyticsInput,
  GscTopQueriesInput,
} from './schemas.js';

/** `list_ga4_properties()` — GA4 Admin listing (currently a stub in @aeo/google-api). */
export async function listGa4Properties(ctx: ToolContext): Promise<ToolResult> {
  const ga4 = await ga4For(ctx);
  const properties = await ga4.listProperties();
  const note =
    properties.length === 0
      ? 'No properties returned. NOTE: GA4 Admin listing is a stub in @aeo/google-api ' +
        '(0.1.0); pass an explicit propertyId to ga4_run_report meanwhile.'
      : `Found ${properties.length} GA4 properties.`;
  return jsonResult(note, { properties });
}

/** `list_gsc_sites()` — Search Console sites the token can access. */
export async function listGscSites(ctx: ToolContext): Promise<ToolResult> {
  const gsc = await gscFor(ctx);
  const sites = await gsc.listSites();
  return jsonResult(`Found ${sites.length} Search Console sites.`, { sites });
}

/** `ga4_run_report({ propertyId, dateRanges, dimensions, metrics })`. */
export async function ga4RunReport(
  ctx: ToolContext,
  input: Ga4RunReportInput,
): Promise<ToolResult> {
  const ga4 = await ga4For(ctx);
  const report = await ga4.runReport({
    propertyId: input.propertyId,
    dateRanges: input.dateRanges,
    dimensions: input.dimensions,
    metrics: input.metrics,
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
  });
  return jsonResult(`GA4 report for property ${input.propertyId}: ${report.rowCount} rows.`, {
    propertyId: input.propertyId,
    rowCount: report.rowCount,
    rows: report.rows,
  });
}

/** `gsc_search_analytics({ siteUrl, startDate, endDate, dimensions })`. */
export async function gscSearchAnalytics(
  ctx: ToolContext,
  input: GscSearchAnalyticsInput,
): Promise<ToolResult> {
  const gsc = await gscFor(ctx);
  const report = await gsc.query({
    siteUrl: input.siteUrl,
    startDate: input.startDate,
    endDate: input.endDate,
    ...(input.dimensions.length > 0 ? { dimensions: input.dimensions } : {}),
    ...(input.rowLimit !== undefined ? { rowLimit: input.rowLimit } : {}),
  });
  return jsonResult(
    `Search analytics for ${input.siteUrl} (${input.startDate}…${input.endDate}): ` +
      `${report.rows.length} rows.`,
    {
      siteUrl: input.siteUrl,
      range: { startDate: input.startDate, endDate: input.endDate },
      dimensions: input.dimensions,
      rows: report.rows,
    },
  );
}

/** `gsc_top_queries({ siteUrl, days, limit })`. */
export async function gscTopQueries(
  ctx: ToolContext,
  input: GscTopQueriesInput,
): Promise<ToolResult> {
  const range = lastNDays(input.days);
  const gsc = await gscFor(ctx);
  const report = await gsc.query({
    siteUrl: input.siteUrl,
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: ['query'],
    rowLimit: Math.min(25_000, Math.max(input.limit, input.limit * 4)),
  });
  const stats = toQueryStats(report.rows);
  const top = topQueriesByClicks(stats, input.limit);
  return jsonResult(
    `Top ${top.length} queries for ${input.siteUrl} over the last ${input.days} days ` +
      `(${range.startDate}…${range.endDate}).`,
    { siteUrl: input.siteUrl, range, queries: top },
  );
}

/** `gsc_ctr_gaps({ siteUrl, days, minImpressions, maxCtr, limit })`. */
export async function gscCtrGaps(ctx: ToolContext, input: GscCtrGapsInput): Promise<ToolResult> {
  const range = lastNDays(input.days);
  const gsc = await gscFor(ctx);
  const report = await gsc.query({
    siteUrl: input.siteUrl,
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: ['query'],
    rowLimit: 25_000,
  });
  const stats = toQueryStats(report.rows);
  const gaps = findCtrGaps(stats, {
    minImpressions: input.minImpressions || DEFAULT_CTR_GAP_OPTIONS.minImpressions,
    maxCtr: input.maxCtr,
    limit: input.limit,
  });
  return jsonResult(
    `${gaps.length} CTR-gap queries for ${input.siteUrl} (impressions ≥ ${input.minImpressions}, ` +
      `CTR ≤ ${pct(input.maxCtr)}) over the last ${input.days} days.`,
    {
      siteUrl: input.siteUrl,
      range,
      criteria: { minImpressions: input.minImpressions, maxCtr: input.maxCtr },
      gaps,
    },
  );
}

/** `compare_periods({ siteUrl, rangeA, rangeB })`. */
export async function comparePeriodsTool(
  ctx: ToolContext,
  input: ComparePeriodsInput,
): Promise<ToolResult> {
  const gsc = await gscFor(ctx);
  const [reportA, reportB] = await Promise.all([
    gsc.query({
      siteUrl: input.siteUrl,
      startDate: input.rangeA.startDate,
      endDate: input.rangeA.endDate,
    }),
    gsc.query({
      siteUrl: input.siteUrl,
      startDate: input.rangeB.startDate,
      endDate: input.rangeB.endDate,
    }),
  ]);
  const totalsA = aggregate(reportA.rows);
  const totalsB = aggregate(reportB.rows);
  const comparison = comparePeriods(totalsA, totalsB);

  const rangeLabel = (r: DateRange): string => `${r.startDate}…${r.endDate}`;
  return jsonResult(
    `Period comparison for ${input.siteUrl}: A (${rangeLabel(input.rangeA)}) vs ` +
      `B (${rangeLabel(input.rangeB)}). Clicks ${totalsA.clicks} → ${totalsB.clicks}.`,
    {
      siteUrl: input.siteUrl,
      rangeA: input.rangeA,
      rangeB: input.rangeB,
      totalsA,
      totalsB,
      comparison,
    },
  );
}
