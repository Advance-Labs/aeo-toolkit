/**
 * Pure analytics transforms over GSC rows — the testable heart of the higher-level
 * tools (`gsc_top_queries`, `gsc_ctr_gaps`, `compare_periods`). No network, no
 * clients: these take already-fetched {@link GscRow}s and produce derived shapes.
 */
import type { GscRow } from '@advance-labs/types';
import { round } from './format.js';

/** A query row flattened to its single dimension key (used by top-queries). */
export interface QueryStat {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Project GSC rows (queried with `dimensions: ['query']`) into {@link QueryStat}. */
export function toQueryStats(rows: GscRow[]): QueryStat[] {
  return rows.map((row) => ({
    query: row.keys[0] ?? '',
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: round(row.ctr),
    position: round(row.position, 2),
  }));
}

/** Sort query stats by clicks (desc), tie-broken by impressions, and take `limit`. */
export function topQueriesByClicks(stats: QueryStat[], limit: number): QueryStat[] {
  return [...stats]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, Math.max(0, limit));
}

export interface CtrGapOptions {
  /** Only consider rows with at least this many impressions. */
  minImpressions: number;
  /** Flag rows whose CTR is at or below this ratio (0..1). */
  maxCtr: number;
  /** Cap on returned rows. */
  limit: number;
}

export const DEFAULT_CTR_GAP_OPTIONS: CtrGapOptions = {
  minImpressions: 100,
  maxCtr: 0.02,
  limit: 25,
};

/**
 * CTR gaps: high-impression, low-CTR queries — pages that are *seen* a lot but
 * rarely *clicked*, the prime targets for title/meta or snippet optimisation.
 * Ranked by impressions desc so the biggest missed-opportunity rows surface first.
 */
export function findCtrGaps(stats: QueryStat[], opts: CtrGapOptions): QueryStat[] {
  return stats
    .filter((s) => s.impressions >= opts.minImpressions && s.ctr <= opts.maxCtr)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, Math.max(0, opts.limit));
}

/** Aggregate totals across a set of GSC rows. */
export interface GscTotals {
  clicks: number;
  impressions: number;
  /** Aggregate CTR = clicks / impressions (0 when no impressions). */
  ctr: number;
  /** Impression-weighted average position (0 when no impressions). */
  position: number;
}

/** Sum clicks/impressions and compute aggregate CTR + impression-weighted position. */
export function aggregate(rows: GscRow[]): GscTotals {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? round(clicks / impressions) : 0,
    position: impressions > 0 ? round(weightedPosition / impressions, 2) : 0,
  };
}

/** A single metric's value across two periods plus absolute + relative deltas. */
export interface MetricDelta {
  a: number;
  b: number;
  delta: number;
  /** Relative change (b-a)/a as a ratio; `null` when `a` is 0 (undefined growth). */
  deltaPct: number | null;
}

/** Build a {@link MetricDelta} from two scalar values. */
export function metricDelta(a: number, b: number): MetricDelta {
  const delta = round(b - a, 4);
  const deltaPct = a !== 0 ? round((b - a) / a) : null;
  return { a: round(a, 4), b: round(b, 4), delta, deltaPct };
}

/** Side-by-side comparison of two periods' aggregate totals. */
export interface PeriodComparison {
  clicks: MetricDelta;
  impressions: MetricDelta;
  ctr: MetricDelta;
  position: MetricDelta;
}

/** Compare two already-aggregated period totals into per-metric deltas. */
export function comparePeriods(a: GscTotals, b: GscTotals): PeriodComparison {
  return {
    clicks: metricDelta(a.clicks, b.clicks),
    impressions: metricDelta(a.impressions, b.impressions),
    ctr: metricDelta(a.ctr, b.ctr),
    position: metricDelta(a.position, b.position),
  };
}
