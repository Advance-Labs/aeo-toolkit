/**
 * Divergence classification — the judgement the whole cross-engine surface exists
 * to make.
 *
 * A page holding on Bing while it drops on Google is a Google ranking problem. A
 * page dropping on both is a content or technical problem. Those two findings send
 * a client's next month of work in opposite directions, and no single-engine
 * connector can tell them apart.
 *
 * `insufficient_data` is checked FIRST and wins over every other classification. A
 * 100% drop from two clicks is noise; classifying it would manufacture a finding,
 * and a manufactured finding is worse than a missing one because it is
 * indistinguishable from a real one downstream.
 *
 * REGISTERED as `engine_divergence` since 2026-09-09. It was cut for one day
 * because `GetQueryStats(siteUrl)` accepts no date parameter: calling it twice for
 * two halves returned the identical aggregate, `bingDelta` was identically 0, and
 * `broad`/`bing_specific` were structurally unreachable. A live check against the
 * Bing Webmaster API settled it — Bing returns one row per (query x date)
 * (`maxRowsForOneQuery=3` across `distinctDates=6`), so the caller fetches once and
 * buckets locally by each row's own date. The API still takes no date parameter;
 * the windowing simply moved client-side. See `bucketBingQueriesByDate` in
 * `./normalize.ts` and the docblock on `engineDivergence` in `./handlers.ts`.
 *
 * This module's classifier was never the defect, and is unchanged.
 */

export type DivergenceClass =
  | 'google_specific'
  | 'bing_specific'
  | 'broad'
  | 'insufficient_data';

export interface DivergenceOptions {
  /** Fractional click change that counts as a move. 0.3 == 30%. */
  threshold: number;
  /** Baseline-half clicks below which a row cannot be classified. */
  minClicks: number;
}

/**
 * Fractional change from `baseline` to `current`.
 *
 * @returns `null` from a zero (or negative, or non-finite) baseline — the change is
 * undefined, not infinite.
 */
export function fractionalDelta(baseline: number, current: number): number | null {
  if (!Number.isFinite(baseline) || baseline <= 0) return null;
  return (current - baseline) / baseline;
}

export interface ClassifyInput {
  googleDelta: number | null;
  bingDelta: number | null;
  googleBaseClicks: number;
  bingBaseClicks: number;
}

/** Classify one key's cross-engine movement. */
export function classifyDivergence(
  input: ClassifyInput,
  opts: DivergenceOptions,
): DivergenceClass {
  // Thin data wins over every other verdict. Checked first, deliberately.
  if (
    input.googleDelta === null ||
    input.bingDelta === null ||
    input.googleBaseClicks < opts.minClicks ||
    input.bingBaseClicks < opts.minClicks
  ) {
    return 'insufficient_data';
  }

  const limit = -opts.threshold;
  const googleDropped = input.googleDelta < limit;
  const bingDropped = input.bingDelta < limit;

  if (googleDropped && bingDropped) return 'broad';
  if (googleDropped) return 'google_specific';
  if (bingDropped) return 'bing_specific';
  return 'insufficient_data';
}

/** Plain-language reading of a class, carried in the tool output. */
export const DIVERGENCE_MEANING: Record<DivergenceClass, string> = {
  google_specific:
    'Held on Bing, dropped on Google. Suspect a Google ranking or indexing change ' +
    'rather than the content itself.',
  bing_specific:
    'Held on Google, dropped on Bing. Suspect Bing indexing, or a Bing-specific ' +
    'crawl or verification problem.',
  broad:
    'Dropped on both engines. Suspect the content or a technical problem on the ' +
    'page, not one engine.',
  insufficient_data:
    'Not enough baseline traffic on at least one engine to call this, or neither ' +
    'engine moved past the threshold.',
};
