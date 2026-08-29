/**
 * Pure diagnostic transforms over GSC rows — the workflow tier above the raw
 * primitives in `analytics.ts`.
 *
 * `analytics.ts` answers "what are the numbers"; this module answers the three
 * questions people actually open Search Console to ask:
 *
 *   - traffic dropped, *which pages caused it*      → {@link attributeDecline}
 *   - is a page quietly bleeding traffic            → {@link findDecay}
 *   - are two of my pages fighting for one query    → {@link findCannibalization}
 *
 * All three read already-fetched {@link GscRow}s and do no I/O, so they unit-test
 * against fixed arrays. The handlers in `handlers.ts` supply the rows.
 */
import type { GscRow } from '@aeo/types';
import { round } from './format.js';

/** Running totals for one dimension key within a single period. */
interface Bucket {
  clicks: number;
  impressions: number;
  /** Σ(position × impressions), divided out at the end for a weighted mean. */
  weightedPosition: number;
}

/**
 * Fold rows onto one dimension key, summing clicks/impressions and accumulating an
 * impression-weighted position.
 *
 * Position is weighted rather than averaged because GSC reports a mean position per
 * row: a row with 5 impressions at position 2 and one with 500 at position 40 do not
 * describe a page ranking at 21.
 */
function foldByKey(rows: GscRow[], keyIndex: number): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    const key = row.keys[keyIndex];
    if (key === undefined) continue; // malformed row for this dimension; skip rather than throw
    const bucket = buckets.get(key) ?? { clicks: 0, impressions: 0, weightedPosition: 0 };
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    bucket.weightedPosition += row.position * row.impressions;
    buckets.set(key, bucket);
  }
  return buckets;
}

/** Impression-weighted mean position, or 0 when the key drew no impressions. */
function meanPosition(bucket: Bucket | undefined): number {
  if (bucket === undefined || bucket.impressions === 0) return 0;
  return round(bucket.weightedPosition / bucket.impressions, 2);
}

/** One dimension key's before/after performance across two periods. */
export interface KeyedDelta {
  /** The dimension value: a page URL, or a query string. */
  key: string;
  clicksBefore: number;
  clicksAfter: number;
  /** Negative means clicks were lost. */
  clicksDelta: number;
  impressionsBefore: number;
  impressionsAfter: number;
  impressionsDelta: number;
  positionBefore: number;
  positionAfter: number;
  /**
   * Change in weighted position. **Positive means the page moved DOWN** the results
   * page (rank got worse), because GSC counts position 1 as the top slot.
   *
   * `null` when either period drew no impressions, since there is no position to
   * compare against — distinct from a delta of 0, which means rank held steady.
   */
  positionDelta: number | null;
}

/**
 * Per-key before/after deltas across two periods.
 *
 * Keys present in only one period are included, with zeroes on the missing side: a
 * page that appeared or vanished is one of the strongest signals in the data and
 * dropping it would hide exactly the pages worth looking at.
 *
 * @param keyIndex which dimension to fold on (0 for a single-dimension query).
 */
export function keyedDeltas(before: GscRow[], after: GscRow[], keyIndex = 0): KeyedDelta[] {
  const a = foldByKey(before, keyIndex);
  const b = foldByKey(after, keyIndex);

  return [...new Set([...a.keys(), ...b.keys()])].map((key) => {
    const bucketA = a.get(key);
    const bucketB = b.get(key);
    const clicksBefore = bucketA?.clicks ?? 0;
    const clicksAfter = bucketB?.clicks ?? 0;
    const impressionsBefore = bucketA?.impressions ?? 0;
    const impressionsAfter = bucketB?.impressions ?? 0;
    const positionBefore = meanPosition(bucketA);
    const positionAfter = meanPosition(bucketB);
    const comparable = impressionsBefore > 0 && impressionsAfter > 0;

    return {
      key,
      clicksBefore,
      clicksAfter,
      clicksDelta: clicksAfter - clicksBefore,
      impressionsBefore,
      impressionsAfter,
      impressionsDelta: impressionsAfter - impressionsBefore,
      positionBefore,
      positionAfter,
      positionDelta: comparable ? round(positionAfter - positionBefore, 2) : null,
    };
  });
}

/** A key that lost clicks, with its share of the site's total decline. */
export interface DeclineContributor extends KeyedDelta {
  /**
   * This key's share of the total clicks lost across every declining key (0..1).
   *
   * Denominator is the sum of losses only, NOT the net change. If a site lost 100
   * clicks on one page and gained 90 on another, the net is -10 but this page is
   * still 100% of the decline — which is the number a reader needs to act on.
   */
  shareOfDecline: number;
}

/** The attributed answer to "traffic dropped, what caused it". */
export interface DeclineAttribution {
  /** Net click change across every key, gains and losses together. */
  netClicksDelta: number;
  /** Total clicks lost, counting declining keys only (a positive number). */
  totalClicksLost: number;
  /** Total clicks gained, counting growing keys only (a positive number). */
  totalClicksGained: number;
  /** Declining keys, biggest loss first, capped at `limit`. */
  contributors: DeclineContributor[];
  /** How many keys declined in total, including any beyond `limit`. */
  decliningKeyCount: number;
}

/**
 * Attribute a click change to the individual keys that caused it.
 *
 * Reports gains and losses separately rather than only the net, because a flat net
 * can hide a page that collapsed while another grew — the single most common way a
 * period-over-period summary misleads.
 */
export function attributeDecline(deltas: KeyedDelta[], limit: number): DeclineAttribution {
  let totalClicksLost = 0;
  let totalClicksGained = 0;
  for (const d of deltas) {
    if (d.clicksDelta < 0) totalClicksLost += -d.clicksDelta;
    else totalClicksGained += d.clicksDelta;
  }

  const declining = deltas
    .filter((d) => d.clicksDelta < 0)
    .sort((a, b) => a.clicksDelta - b.clicksDelta || b.impressionsBefore - a.impressionsBefore);

  const contributors = declining.slice(0, Math.max(0, limit)).map((d) => ({
    ...d,
    // Guarded: totalClicksLost is 0 only when nothing declined, in which case this
    // map does not run at all. Kept explicit so the expression cannot divide by 0.
    shareOfDecline: totalClicksLost > 0 ? round(-d.clicksDelta / totalClicksLost) : 0,
  }));

  return {
    netClicksDelta: totalClicksGained - totalClicksLost,
    totalClicksLost,
    totalClicksGained,
    contributors,
    decliningKeyCount: declining.length,
  };
}

export interface DecayOptions {
  /** Ignore keys with fewer baseline impressions than this. */
  minImpressions: number;
  /** Flag keys whose clicks fell by at least this fraction (0..1). */
  minDeclinePct: number;
  /** Cap on returned rows. */
  limit: number;
}

export const DEFAULT_DECAY_OPTIONS: DecayOptions = {
  minImpressions: 100,
  minDeclinePct: 0.2,
  limit: 25,
};

/** A key in sustained decline. */
export interface DecayCandidate extends KeyedDelta {
  /** Fraction of baseline clicks lost (0..1). 1 means it went to zero. */
  declinePct: number;
  /**
   * Whether rank slipped alongside the click loss.
   *
   * `true` points at competitors outranking the page; `false` (clicks down, rank
   * held) points at seasonality or a SERP layout change instead. `null` when there
   * is no comparable position. This is a hint for the reader, not a verdict — GSC
   * data alone cannot separate seasonality from a real problem.
   */
  lostRank: boolean | null;
}

/**
 * Find keys bleeding traffic between two equal-length adjacent windows.
 *
 * The impression threshold gates on the **baseline** window on purpose. Gating on
 * the recent window would drop pages that decayed close to zero, which are the
 * worst cases and the whole point of the report.
 */
export function findDecay(deltas: KeyedDelta[], opts: DecayOptions): DecayCandidate[] {
  return deltas
    .filter((d) => d.impressionsBefore >= opts.minImpressions && d.clicksBefore > 0)
    .map((d) => ({
      ...d,
      declinePct: round(-d.clicksDelta / d.clicksBefore),
      lostRank: d.positionDelta === null ? null : d.positionDelta > 0,
    }))
    .filter((d) => d.declinePct >= opts.minDeclinePct)
    .sort((a, b) => b.declinePct - a.declinePct || b.impressionsBefore - a.impressionsBefore)
    .slice(0, Math.max(0, opts.limit));
}

/** One page competing for a query. */
export interface CompetingPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** A query that more than one page on the site ranks for. */
export interface CannibalGroup {
  query: string;
  totalClicks: number;
  totalImpressions: number;
  /** Competing pages, best-ranking first. */
  pages: CompetingPage[];
  /** The best-ranking page — the natural consolidation target. See below. */
  strongestPage: string;
  /**
   * Why {@link strongestPage} was chosen, stated so the caller can disagree.
   *
   * The rule is *best average position*, not most clicks. A page at position 4 with
   * few clicks is usually a better thing to consolidate onto than one at position 30
   * with more, because rank is the harder half to earn back.
   */
  strongestPageReason: string;
}

export interface CannibalOptions {
  /** A page must draw at least this many impressions for the query to count. */
  minImpressions: number;
  /** Cap on returned groups. */
  limit: number;
}

export const DEFAULT_CANNIBAL_OPTIONS: CannibalOptions = {
  minImpressions: 50,
  limit: 25,
};

/**
 * Find queries that two or more of the site's own pages rank for.
 *
 * Expects rows fetched with `dimensions: ['query', 'page']`.
 *
 * The impression threshold applies **per page**, not per query: without that, one
 * strong page plus a dozen long-tail impressions on unrelated URLs would look like
 * cannibalisation on nearly every query.
 *
 * Overlap is reported as evidence, not as a fault. Two pages legitimately ranking
 * for one broad query is common and often fine; this surfaces the candidates and
 * leaves the judgement to a human.
 */
export function findCannibalization(rows: GscRow[], opts: CannibalOptions): CannibalGroup[] {
  const byQuery = new Map<string, Map<string, Bucket>>();
  for (const row of rows) {
    const query = row.keys[0];
    const page = row.keys[1];
    if (query === undefined || page === undefined) continue; // needs both dimensions
    const pages = byQuery.get(query) ?? new Map<string, Bucket>();
    const bucket = pages.get(page) ?? { clicks: 0, impressions: 0, weightedPosition: 0 };
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    bucket.weightedPosition += row.position * row.impressions;
    pages.set(page, bucket);
    byQuery.set(query, pages);
  }

  const groups: CannibalGroup[] = [];
  for (const [query, pageBuckets] of byQuery) {
    const pages: CompetingPage[] = [...pageBuckets]
      .filter(([, bucket]) => bucket.impressions >= opts.minImpressions)
      .map(([page, bucket]) => ({
        page,
        clicks: bucket.clicks,
        impressions: bucket.impressions,
        ctr: bucket.impressions > 0 ? round(bucket.clicks / bucket.impressions) : 0,
        position: meanPosition(bucket),
      }))
      .sort((a, b) => a.position - b.position || b.clicks - a.clicks);

    if (pages.length < 2) continue; // one page ranking for a query is the healthy case

    const strongest = pages[0];
    if (strongest === undefined) continue; // unreachable given length >= 2; satisfies the checker

    groups.push({
      query,
      totalClicks: pages.reduce((acc, p) => acc + p.clicks, 0),
      totalImpressions: pages.reduce((acc, p) => acc + p.impressions, 0),
      pages,
      strongestPage: strongest.page,
      strongestPageReason: `best average position (${strongest.position}) of ${pages.length} competing pages`,
    });
  }

  return groups
    .sort((a, b) => b.totalImpressions - a.totalImpressions || b.pages.length - a.pages.length)
    .slice(0, Math.max(0, opts.limit));
}
