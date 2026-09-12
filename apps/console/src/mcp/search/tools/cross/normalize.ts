/**
 * Shared row shape for cross-engine comparison, plus the honesty layer.
 *
 * Two rules this module exists to enforce:
 *
 *  1. ZERO-FILL IS BANNED. A missing engine value is `null` with a reason in
 *     `coverage`, never `0`. A zero-filled Bing row reads as "Bing sent no
 *     traffic" when the truth is "we could not ask" — the exact error that makes
 *     an agent confidently recommend the wrong fix.
 *
 *  2. THE POSITION MAPPING IS DISCLOSED. GSC reports one `position`; Bing reports
 *     both AvgClickPosition and AvgImpressionPosition. We map Bing's
 *     AvgImpressionPosition onto the shared field because that is what GSC's
 *     `position` measures — and we say so in `coverage.notes` so a reading agent
 *     can see the choice was made rather than assume the numbers are natively
 *     comparable.
 */
import type { BingQueryStat } from '@advance-labs/bing-api';
import type { GscRow } from '@advance-labs/types';

export type EngineName = 'google' | 'bing';

/** One engine's numbers for one key (a query or a page). */
export interface EngineRow {
  key: string;
  clicks: number;
  impressions: number;
  /** `null` when impressions are zero — not 0, which would read as "nobody clicked". */
  ctr: number | null;
  /** `null` when the engine reported no usable position. */
  position: number | null;
}

export interface EngineCoverage {
  available: boolean;
  rowCount: number;
  /** Populated only when `available` is false. */
  reason: string | null;
}

export interface Coverage {
  google: EngineCoverage;
  bing: EngineCoverage;
  notes: string[];
}

export interface MergedRow {
  key: string;
  google: EngineRow | null;
  bing: EngineRow | null;
}

export const POSITION_MAPPING_NOTE =
  "Bing's AvgImpressionPosition is mapped onto `position` because that is what " +
  "Google's `position` measures. Bing's AvgClickPosition is a different metric and " +
  'is not represented in this comparison.';

export const BING_WINDOW_NOTE =
  "Bing's rows are the Webmaster API's own aggregate and are NOT scoped to " +
  'startDate/endDate — GetQueryStats accepts no date range. Only the Google rows ' +
  'honour the requested window; do not read a Google-vs-Bing gap as a change over ' +
  'that window.';

/** Clicks over impressions, or `null` when there were no impressions. */
function ratio(clicks: number, impressions: number): number | null {
  return impressions > 0 ? clicks / impressions : null;
}

/**
 * Bing's sentinel for "no position data" is `-1`, not 0 — verified against the live
 * Webmaster API on 2026-09-09, where every zero-click row carried
 * `AvgClickPosition: -1`. The `>= 1` test rejects both spellings, so this guard was
 * already correct; only the stated reason was wrong. A real position is always >= 1.
 */
function usablePosition(value: number | null): number | null {
  if (value === null) return null;
  return Number.isFinite(value) && value >= 1 ? value : null;
}

/** Normalize Bing query rows onto the shared shape. */
export function normalizeBingQueries(rows: BingQueryStat[]): EngineRow[] {
  return rows.map((row) => ({
    key: row.query,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: ratio(row.clicks, row.impressions),
    position: usablePosition(row.avgImpressionPosition),
  }));
}

/**
 * Normalize Google Search Console rows onto the shared shape.
 *
 * `ctr` is recomputed from clicks/impressions rather than read off `row.ctr`:
 * Google supplies `0` for zero impressions, and Rule 1 requires `null` there.
 */
export function normalizeGscRows(rows: GscRow[]): EngineRow[] {
  return rows.map((row) => ({
    key: row.keys[0] ?? '',
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: ratio(row.clicks, row.impressions),
    position: usablePosition(row.position),
  }));
}

/**
 * Outer-join two engines' rows by key.
 *
 * An engine with no row for a key contributes `null`, never a zeroed row.
 * A wholly absent engine (`null` rows) contributes `null` for every key.
 */
export function mergeEngineRows(
  google: EngineRow[] | null,
  bing: EngineRow[] | null,
): MergedRow[] {
  const googleByKey = new Map((google ?? []).map((row) => [row.key, row]));
  const bingByKey = new Map((bing ?? []).map((row) => [row.key, row]));

  const keys = new Set<string>([...googleByKey.keys(), ...bingByKey.keys()]);
  const merged: MergedRow[] = [];
  for (const key of keys) {
    merged.push({
      key,
      google: googleByKey.get(key) ?? null,
      bing: bingByKey.get(key) ?? null,
    });
  }
  return merged;
}

/** Build the coverage block that states what each engine did and did not supply. */
export function buildCoverage(opts: {
  google: { rows: EngineRow[] | null; error: string | null };
  bing: { rows: EngineRow[] | null; error: string | null };
}): Coverage {
  const describe = (side: { rows: EngineRow[] | null; error: string | null }): EngineCoverage =>
    side.rows === null
      ? { available: false, rowCount: 0, reason: side.error ?? 'engine returned no data' }
      : { available: true, rowCount: side.rows.length, reason: null };

  const notes: string[] = [];
  if (opts.bing.rows !== null) {
    notes.push(POSITION_MAPPING_NOTE);
    notes.push(BING_WINDOW_NOTE);
  }

  return { google: describe(opts.google), bing: describe(opts.bing), notes };
}

/**
 * Bucket Bing query rows into a date window and aggregate to one row per query.
 *
 * WHY THIS EXISTS: `GetQueryStats(siteUrl)` accepts no date parameter, so the
 * window cannot be pushed to the API. It CAN be applied here, because Bing returns
 * one row per (query x date) rather than one aggregate per query — verified live on
 * 2026-09-09 (`maxRowsForOneQuery=3` across `distinctDates=6`). Fetch once, bucket
 * locally.
 *
 * Rows whose `date` is `null` cannot be attributed to either half of a comparison.
 * They are NOT silently dropped into the window and NOT counted as zero: they are
 * returned in `undated` so the caller can decide, and a caller comparing two halves
 * must treat a wholly-undated response as unavailable rather than as no traffic.
 *
 * Positions are deliberately not aggregated. Averaging an average across dates
 * without impression weights invents a number; divergence classification reads
 * clicks only, so the field is left `null` rather than fabricated.
 */
export function bucketBingQueriesByDate(
  rows: BingQueryStat[],
  window: { startDate: string; endDate: string },
): { rows: EngineRow[]; undated: number; dated: number } {
  const totals = new Map<string, { clicks: number; impressions: number }>();
  let undated = 0;
  let dated = 0;

  for (const row of rows) {
    if (row.date === null) {
      undated += 1;
      continue;
    }
    dated += 1;
    // `date` is a full ISO timestamp; the window is YYYY-MM-DD and inclusive.
    const day = row.date.slice(0, 10);
    if (day < window.startDate || day > window.endDate) continue;

    const acc = totals.get(row.query) ?? { clicks: 0, impressions: 0 };
    acc.clicks += row.clicks;
    acc.impressions += row.impressions;
    totals.set(row.query, acc);
  }

  const bucketed: EngineRow[] = [...totals.entries()].map(([key, acc]) => ({
    key,
    clicks: acc.clicks,
    impressions: acc.impressions,
    ctr: ratio(acc.clicks, acc.impressions),
    position: null,
  }));

  return { rows: bucketed, undated, dated };
}
