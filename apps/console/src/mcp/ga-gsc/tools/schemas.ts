/**
 * Zod input schemas for every GA4/GSC MCP tool. Kept separate from the handlers so
 * both the registry and the tests can reference the same validated shapes.
 *
 * `verbatimModuleSyntax` is on: `z` is a runtime value (used to build schemas), so
 * it is a normal import; only types use `import type`.
 */
import { z } from 'zod';

/** A `YYYY-MM-DD` date string accepted by both GA4 and GSC. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format');

const dateRange = z.object({
  startDate: isoDate,
  endDate: isoDate,
});

const gscDimension = z.enum(['query', 'page', 'country', 'device', 'date', 'searchAppearance']);

/** `ga4_run_report({ propertyId, dateRanges, dimensions, metrics })`. */
export const ga4RunReportShape = {
  propertyId: z.string().min(1).describe('GA4 property id, e.g. "123456" or "properties/123456".'),
  dateRanges: z
    .array(dateRange)
    .min(1)
    .describe('One or more {startDate,endDate} ranges (YYYY-MM-DD).'),
  dimensions: z
    .array(z.string().min(1))
    .default([])
    .describe('GA4 dimension names, e.g. ["date","pagePath"].'),
  metrics: z
    .array(z.string().min(1))
    .min(1)
    .describe('GA4 metric names, e.g. ["screenPageViews","totalUsers"].'),
  limit: z.number().int().positive().max(100_000).optional().describe('Max rows to return.'),
} as const;

/** `gsc_search_analytics({ siteUrl, startDate, endDate, dimensions })`. */
export const gscSearchAnalyticsShape = {
  siteUrl: z
    .string()
    .min(1)
    .describe('GSC property URL, e.g. "https://example.com/" or "sc-domain:example.com".'),
  startDate: isoDate,
  endDate: isoDate,
  dimensions: z
    .array(gscDimension)
    .default([])
    .describe('GSC dimensions to break down by, e.g. ["query","page"].'),
  rowLimit: z.number().int().positive().max(25_000).optional().describe('Max rows to return.'),
} as const;

/** `gsc_top_queries({ siteUrl, days })`. */
export const gscTopQueriesShape = {
  siteUrl: z.string().min(1).describe('GSC property URL.'),
  days: z
    .number()
    .int()
    .positive()
    .max(480)
    .default(28)
    .describe('Look-back window in days (default 28).'),
  limit: z.number().int().positive().max(1000).default(25).describe('Top-N queries to return.'),
} as const;

/** `gsc_ctr_gaps({ siteUrl, days })`. */
export const gscCtrGapsShape = {
  siteUrl: z.string().min(1).describe('GSC property URL.'),
  days: z.number().int().positive().max(480).default(28).describe('Look-back window in days.'),
  minImpressions: z
    .number()
    .int()
    .nonnegative()
    .default(100)
    .describe('Only flag queries with at least this many impressions.'),
  maxCtr: z
    .number()
    .min(0)
    .max(1)
    .default(0.02)
    .describe('Flag queries whose CTR is at or below this ratio (0..1).'),
  limit: z.number().int().positive().max(1000).default(25).describe('Max gap rows to return.'),
} as const;

/** `compare_periods({ siteUrl, rangeA, rangeB })`. */
export const comparePeriodsShape = {
  siteUrl: z.string().min(1).describe('GSC property URL.'),
  rangeA: dateRange.describe('Baseline period.'),
  rangeB: dateRange.describe('Comparison period.'),
} as const;

/** `gsc_traffic_drop({ siteUrl, rangeA, rangeB, dimension })`. */
export const gscTrafficDropShape = {
  siteUrl: z.string().min(1).describe('GSC property URL.'),
  rangeA: dateRange.describe('Baseline period (the "before").'),
  rangeB: dateRange.describe('Comparison period (the "after").'),
  dimension: z
    .enum(['page', 'query'])
    .default('page')
    .describe('Attribute the change to pages or to queries.'),
  limit: z.number().int().positive().max(1000).default(20).describe('Max contributors to return.'),
} as const;

/** `gsc_cannibalization({ siteUrl, days, minImpressions, limit })`. */
export const gscCannibalizationShape = {
  siteUrl: z.string().min(1).describe('GSC property URL.'),
  days: z.number().int().positive().max(480).default(28).describe('Look-back window in days.'),
  minImpressions: z
    .number()
    .int()
    .nonnegative()
    .default(50)
    .describe('A page needs at least this many impressions on a query to count as competing.'),
  limit: z.number().int().positive().max(1000).default(25).describe('Max query groups to return.'),
} as const;

/** `gsc_decay({ siteUrl, windowDays, minImpressions, minDeclinePct, limit })`. */
export const gscDecayShape = {
  siteUrl: z.string().min(1).describe('GSC property URL.'),
  windowDays: z
    .number()
    .int()
    .positive()
    .max(240)
    .default(28)
    .describe('Length of each window; the recent window is compared to the one before it.'),
  minImpressions: z
    .number()
    .int()
    .nonnegative()
    .default(100)
    .describe('Ignore pages with fewer baseline-window impressions than this.'),
  minDeclinePct: z
    .number()
    .min(0)
    .max(1)
    .default(0.2)
    .describe('Flag pages whose clicks fell by at least this fraction (0..1).'),
  limit: z.number().int().positive().max(1000).default(25).describe('Max decaying pages.'),
} as const;

/** Empty-input tools (`list_ga4_properties`, `list_gsc_sites`). */
export const emptyShape = {} as const;

export type Ga4RunReportInput = z.infer<z.ZodObject<typeof ga4RunReportShape>>;
export type GscSearchAnalyticsInput = z.infer<z.ZodObject<typeof gscSearchAnalyticsShape>>;
export type GscTopQueriesInput = z.infer<z.ZodObject<typeof gscTopQueriesShape>>;
export type GscCtrGapsInput = z.infer<z.ZodObject<typeof gscCtrGapsShape>>;
export type ComparePeriodsInput = z.infer<z.ZodObject<typeof comparePeriodsShape>>;
export type GscTrafficDropInput = z.infer<z.ZodObject<typeof gscTrafficDropShape>>;
export type GscCannibalizationInput = z.infer<z.ZodObject<typeof gscCannibalizationShape>>;
export type GscDecayInput = z.infer<z.ZodObject<typeof gscDecayShape>>;
