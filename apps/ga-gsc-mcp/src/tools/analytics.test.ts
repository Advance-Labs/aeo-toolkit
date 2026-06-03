import { describe, expect, it } from 'vitest';
import type { GscRow } from '@aeo/types';
import {
  aggregate,
  comparePeriods,
  findCtrGaps,
  metricDelta,
  toQueryStats,
  topQueriesByClicks,
} from './analytics.js';

function row(partial: Partial<GscRow> & { keys: string[] }): GscRow {
  return {
    keys: partial.keys,
    clicks: partial.clicks ?? 0,
    impressions: partial.impressions ?? 0,
    ctr: partial.ctr ?? 0,
    position: partial.position ?? 0,
  };
}

describe('toQueryStats', () => {
  it('projects the first key as the query and rounds ratios', () => {
    const stats = toQueryStats([
      row({ keys: ['shoes'], clicks: 10, impressions: 100, ctr: 0.1234567, position: 3.456 }),
    ]);
    expect(stats).toEqual([
      { query: 'shoes', clicks: 10, impressions: 100, ctr: 0.1235, position: 3.46 },
    ]);
  });

  it('handles rows with no keys (noUncheckedIndexedAccess guard)', () => {
    const stats = toQueryStats([row({ keys: [] })]);
    expect(stats[0]?.query).toBe('');
  });
});

describe('topQueriesByClicks', () => {
  it('sorts by clicks desc, breaks ties on impressions, and limits', () => {
    const stats = toQueryStats([
      row({ keys: ['a'], clicks: 5, impressions: 50 }),
      row({ keys: ['b'], clicks: 10, impressions: 80 }),
      row({ keys: ['c'], clicks: 10, impressions: 200 }),
    ]);
    const top = topQueriesByClicks(stats, 2);
    expect(top.map((s) => s.query)).toEqual(['c', 'b']);
  });
});

describe('findCtrGaps', () => {
  it('keeps only high-impression, low-CTR rows ranked by impressions', () => {
    const stats = toQueryStats([
      row({ keys: ['high-ctr'], impressions: 500, ctr: 0.2 }),
      row({ keys: ['gap-big'], impressions: 1000, ctr: 0.01 }),
      row({ keys: ['gap-small'], impressions: 150, ctr: 0.005 }),
      row({ keys: ['too-few'], impressions: 50, ctr: 0.0 }),
    ]);
    const gaps = findCtrGaps(stats, { minImpressions: 100, maxCtr: 0.02, limit: 10 });
    expect(gaps.map((g) => g.query)).toEqual(['gap-big', 'gap-small']);
  });

  it('respects the limit', () => {
    const stats = toQueryStats([
      row({ keys: ['x'], impressions: 1000, ctr: 0.001 }),
      row({ keys: ['y'], impressions: 900, ctr: 0.001 }),
    ]);
    expect(findCtrGaps(stats, { minImpressions: 100, maxCtr: 0.02, limit: 1 })).toHaveLength(1);
  });
});

describe('aggregate', () => {
  it('sums clicks/impressions and computes aggregate CTR + weighted position', () => {
    const totals = aggregate([
      row({ keys: ['a'], clicks: 10, impressions: 100, position: 2 }),
      row({ keys: ['b'], clicks: 30, impressions: 300, position: 6 }),
    ]);
    expect(totals.clicks).toBe(40);
    expect(totals.impressions).toBe(400);
    expect(totals.ctr).toBe(0.1);
    // weighted position = (2*100 + 6*300)/400 = 5
    expect(totals.position).toBe(5);
  });

  it('returns zeros for an empty set without dividing by zero', () => {
    expect(aggregate([])).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
  });
});

describe('metricDelta / comparePeriods', () => {
  it('computes absolute and relative deltas', () => {
    expect(metricDelta(100, 150)).toEqual({ a: 100, b: 150, delta: 50, deltaPct: 0.5 });
  });

  it('returns null deltaPct when the baseline is zero', () => {
    expect(metricDelta(0, 5).deltaPct).toBeNull();
  });

  it('compares two aggregate totals across all metrics', () => {
    const a = aggregate([row({ keys: ['a'], clicks: 10, impressions: 100, position: 4 })]);
    const b = aggregate([row({ keys: ['b'], clicks: 20, impressions: 100, position: 2 })]);
    const cmp = comparePeriods(a, b);
    expect(cmp.clicks.delta).toBe(10);
    expect(cmp.position.delta).toBe(-2);
  });
});
