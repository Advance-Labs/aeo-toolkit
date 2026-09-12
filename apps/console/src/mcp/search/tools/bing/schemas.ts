/**
 * Zod input schemas for the Bing Webmaster MCP tools.
 *
 * Deliberately NOT shared with the GSC shapes. Bing exposes query-by-page as two
 * separate methods rather than a `dimensions` array, so a common schema would
 * accept parameters one engine silently ignores — and an agent would trust a
 * field that was dropped.
 */
import { z } from 'zod';

const siteUrl = z
  .string()
  .min(1)
  .describe('Bing Webmaster site URL as verified, e.g. "https://example.com/".');

/** `list_bing_sites()`. */
export const listBingSitesShape = {} as const;

/** Shared by `bing_traffic_stats`, `bing_top_queries`, `bing_top_pages`. */
export const bingSiteShape = {
  siteUrl,
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .default(50)
    .describe('Max rows to return, highest clicks first.'),
} as const;

/** `bing_query_pages({ siteUrl, query? , page? })` — exactly one of query/page. */
export const bingQueryPagesShape = {
  siteUrl,
  query: z.string().min(1).optional().describe('Return the pages that served this query.'),
  page: z.string().min(1).optional().describe('Return the queries this page served.'),
} as const;

/** `bing_index_health({ siteUrl, url? })`. */
export const bingIndexHealthShape = {
  siteUrl,
  url: z
    .string()
    .min(1)
    .optional()
    .describe('Optional single URL to inspect in addition to site-level stats.'),
} as const;

/** `bing_keyword_research({ query, country?, language? })`. */
export const bingKeywordResearchShape = {
  query: z.string().min(1).describe('Seed keyword.'),
  country: z
    .string()
    .length(2)
    .optional()
    .describe('ISO 3166-1 alpha-2, e.g. "ca". Case-insensitive here; lowercased for Bing.'),
  language: z
    .string()
    .min(2)
    .max(5)
    .optional()
    .describe(
      'Region-qualified language tag, e.g. "en-CA". Bing rejects a bare "en"; if you pass ' +
        'one, also pass `country` and the region is taken from it.',
    ),
} as const;

export type BingSiteInput = z.infer<z.ZodObject<typeof bingSiteShape>>;
export type BingQueryPagesInput = z.infer<z.ZodObject<typeof bingQueryPagesShape>>;
export type BingIndexHealthInput = z.infer<z.ZodObject<typeof bingIndexHealthShape>>;
export type BingKeywordResearchInput = z.infer<z.ZodObject<typeof bingKeywordResearchShape>>;
