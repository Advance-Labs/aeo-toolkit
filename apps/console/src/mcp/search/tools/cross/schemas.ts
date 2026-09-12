/**
 * Zod input schemas for cross-engine MCP tools (`compare_engines`, `engine_divergence`).
 *
 * `verbatimModuleSyntax` is on: `z` is a runtime value (used to build schemas), so
 * it is a normal import; only types use `import type`.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format');

/** `compare_engines({ siteUrl, bingSiteUrl?, startDate, endDate, limit })`. */
export const compareEnginesShape = {
  siteUrl: z.string().min(1).describe('GSC property URL, e.g. "sc-domain:example.com".'),
  bingSiteUrl: z
    .string()
    .min(1)
    .optional()
    .describe('Bing site URL when it differs from the GSC property URL.'),
  startDate: isoDate.describe(
    'Range start (YYYY-MM-DD). Applies to Google only — Bing\'s Webmaster API accepts no ' +
      'date range, so Bing rows are always its own unwindowed aggregate.',
  ),
  endDate: isoDate.describe(
    'Range end (YYYY-MM-DD). Applies to Google only — Bing\'s Webmaster API accepts no date ' +
      'range, so Bing rows are always its own unwindowed aggregate.',
  ),
  limit: z.number().int().positive().max(1000).default(100).describe('Max merged rows.'),
} as const;

/**
 * `engine_divergence({ siteUrl, bingSiteUrl?, startDate, endDate, threshold, minClicks })`.
 *
 * Overrides the inherited `startDate`/`endDate` descriptions. In `compare_engines`
 * the range genuinely applies to Google only; here it applies to BOTH engines,
 * because `engineDivergence` fetches Bing once and buckets its rows locally by each
 * row's own date. Inheriting the "Google only" wording would tell an agent the
 * Bing halves are unwindowed when they are not.
 */
export const engineDivergenceShape = {
  ...compareEnginesShape,
  startDate: isoDate.describe(
    'Range start (YYYY-MM-DD). Applies to BOTH engines: Google is queried per half, ' +
      "and Bing's unwindowed rows are bucketed locally by each row's own date.",
  ),
  endDate: isoDate.describe(
    'Range end (YYYY-MM-DD). Applies to BOTH engines: Google is queried per half, and ' +
      "Bing's unwindowed rows are bucketed locally by each row's own date.",
  ),
  threshold: z
    .number()
    .positive()
    .max(1)
    .default(0.3)
    .describe('Fractional click change that counts as a move. 0.3 == 30%.'),
  minClicks: z
    .number()
    .int()
    .nonnegative()
    .default(50)
    .describe('Baseline-half clicks below which a row is insufficient_data.'),
} as const;

export type CompareEnginesInput = z.infer<z.ZodObject<typeof compareEnginesShape>>;
export type EngineDivergenceInput = z.infer<z.ZodObject<typeof engineDivergenceShape>>;
