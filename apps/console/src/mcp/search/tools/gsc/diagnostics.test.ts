import { describe, expect, it } from 'vitest';
import type { GscRow } from '@advance-labs/types';
import {
  attributeDecline,
  findCannibalization,
  findDecay,
  keyedDeltas,
  DEFAULT_CANNIBAL_OPTIONS,
  DEFAULT_DECAY_OPTIONS,
} from './diagnostics.js';

function row(partial: Partial<GscRow> & { keys: string[] }): GscRow {
  return {
    keys: partial.keys,
    clicks: partial.clicks ?? 0,
    impressions: partial.impressions ?? 0,
    ctr: partial.ctr ?? 0,
    position: partial.position ?? 0,
  };
}

describe('keyedDeltas', () => {
  it('pairs a key across both periods and signs the click delta', () => {
    const deltas = keyedDeltas(
      [row({ keys: ['/a'], clicks: 100, impressions: 1000, position: 3 })],
      [row({ keys: ['/a'], clicks: 60, impressions: 900, position: 5 })],
    );
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({
      key: '/a',
      clicksBefore: 100,
      clicksAfter: 60,
      clicksDelta: -40,
      impressionsDelta: -100,
      positionDelta: 2, // positive = moved down the page
    });
  });

  it('keeps a key that vanished, zeroing the missing side', () => {
    const deltas = keyedDeltas(
      [row({ keys: ['/gone'], clicks: 50, impressions: 500, position: 4 })],
      [],
    );
    expect(deltas[0]).toMatchObject({ key: '/gone', clicksAfter: 0, clicksDelta: -50 });
  });

  it('keeps a key that only appeared in the later period', () => {
    const deltas = keyedDeltas([], [row({ keys: ['/new'], clicks: 25, impressions: 200 })]);
    expect(deltas[0]).toMatchObject({ key: '/new', clicksBefore: 0, clicksDelta: 25 });
  });

  it('reports a null position delta when one period has no impressions', () => {
    // Distinct from 0, which would claim rank held steady.
    const deltas = keyedDeltas(
      [row({ keys: ['/a'], clicks: 10, impressions: 100, position: 3 })],
      [row({ keys: ['/a'], clicks: 0, impressions: 0, position: 0 })],
    );
    expect(deltas[0]?.positionDelta).toBeNull();
  });

  it('weights position by impressions rather than averaging the rows', () => {
    // 5 impressions at position 2 and 500 at position 40 is not a page ranking at 21.
    const deltas = keyedDeltas(
      [
        row({ keys: ['/a'], impressions: 5, position: 2 }),
        row({ keys: ['/a'], impressions: 500, position: 40 }),
      ],
      [],
    );
    expect(deltas[0]?.positionBefore).toBeCloseTo(39.62, 1);
  });

  it('folds on the requested dimension index', () => {
    const rows = [
      row({ keys: ['shoes', '/a'], clicks: 10, impressions: 100 }),
      row({ keys: ['boots', '/a'], clicks: 5, impressions: 50 }),
    ];
    const byPage = keyedDeltas(rows, [], 1);
    expect(byPage).toHaveLength(1);
    expect(byPage[0]).toMatchObject({ key: '/a', clicksBefore: 15 });
  });

  it('skips rows with no value at the requested index instead of throwing', () => {
    expect(() => keyedDeltas([row({ keys: [] })], [], 0)).not.toThrow();
    expect(keyedDeltas([row({ keys: [] })], [], 0)).toEqual([]);
  });
});

describe('attributeDecline', () => {
  const deltas = keyedDeltas(
    [
      row({ keys: ['/big'], clicks: 100, impressions: 1000, position: 3 }),
      row({ keys: ['/small'], clicks: 20, impressions: 200, position: 8 }),
      row({ keys: ['/grew'], clicks: 10, impressions: 100, position: 12 }),
    ],
    [
      row({ keys: ['/big'], clicks: 40, impressions: 800, position: 6 }),
      row({ keys: ['/small'], clicks: 10, impressions: 180, position: 9 }),
      row({ keys: ['/grew'], clicks: 60, impressions: 500, position: 4 }),
    ],
  );

  it('ranks the biggest loser first and shares out the decline', () => {
    const result = attributeDecline(deltas, 10);
    expect(result.contributors.map((c) => c.key)).toEqual(['/big', '/small']);
    expect(result.totalClicksLost).toBe(70); // 60 + 10
    expect(result.contributors[0]?.shareOfDecline).toBeCloseTo(60 / 70, 4);
  });

  it('excludes keys that grew from the contributor list', () => {
    const result = attributeDecline(deltas, 10);
    expect(result.contributors.some((c) => c.key === '/grew')).toBe(false);
    expect(result.totalClicksGained).toBe(50);
  });

  it('separates gains from losses so a flat net cannot hide a collapse', () => {
    // Net is -20, but one page lost 70 clicks. Reporting only the net would bury that.
    const result = attributeDecline(deltas, 10);
    expect(result.netClicksDelta).toBe(-20);
    expect(result.totalClicksLost).toBe(70);
  });

  it('reports the full declining count even when limited', () => {
    const result = attributeDecline(deltas, 1);
    expect(result.contributors).toHaveLength(1);
    expect(result.decliningKeyCount).toBe(2);
  });

  it('returns zeroed totals when nothing declined', () => {
    const growth = keyedDeltas(
      [row({ keys: ['/a'], clicks: 10, impressions: 100 })],
      [row({ keys: ['/a'], clicks: 20, impressions: 200 })],
    );
    const result = attributeDecline(growth, 10);
    expect(result.contributors).toEqual([]);
    expect(result.totalClicksLost).toBe(0);
  });
});

describe('findDecay', () => {
  it('flags a page that lost clicks past the threshold', () => {
    const deltas = keyedDeltas(
      [row({ keys: ['/decaying'], clicks: 100, impressions: 1000, position: 4 })],
      [row({ keys: ['/decaying'], clicks: 40, impressions: 900, position: 9 })],
    );
    const [found] = findDecay(deltas, DEFAULT_DECAY_OPTIONS);
    expect(found?.key).toBe('/decaying');
    expect(found?.declinePct).toBeCloseTo(0.6, 4);
    expect(found?.lostRank).toBe(true);
  });

  it('leaves a stable page alone', () => {
    const deltas = keyedDeltas(
      [row({ keys: ['/stable'], clicks: 100, impressions: 1000, position: 4 })],
      [row({ keys: ['/stable'], clicks: 98, impressions: 990, position: 4 })],
    );
    expect(findDecay(deltas, DEFAULT_DECAY_OPTIONS)).toEqual([]);
  });

  it('excludes low-impression noise', () => {
    const deltas = keyedDeltas(
      [row({ keys: ['/tiny'], clicks: 3, impressions: 10, position: 30 })],
      [row({ keys: ['/tiny'], clicks: 0, impressions: 8, position: 40 })],
    );
    expect(findDecay(deltas, DEFAULT_DECAY_OPTIONS)).toEqual([]);
  });

  it('still reports a page that decayed to zero', () => {
    // The threshold gates on the baseline window precisely so these survive.
    const deltas = keyedDeltas(
      [row({ keys: ['/dead'], clicks: 80, impressions: 900, position: 5 })],
      [],
    );
    const [found] = findDecay(deltas, DEFAULT_DECAY_OPTIONS);
    expect(found?.key).toBe('/dead');
    expect(found?.declinePct).toBe(1);
  });

  it('distinguishes clicks lost at flat rank from clicks lost with rank', () => {
    // Same click loss; different diagnosis. lostRank is what tells them apart.
    const flatRank = keyedDeltas(
      [row({ keys: ['/a'], clicks: 100, impressions: 1000, position: 3 })],
      [row({ keys: ['/a'], clicks: 50, impressions: 1000, position: 3 })],
    );
    expect(findDecay(flatRank, DEFAULT_DECAY_OPTIONS)[0]?.lostRank).toBe(false);
  });

  it('sorts the worst decline first', () => {
    const deltas = keyedDeltas(
      [
        row({ keys: ['/mild'], clicks: 100, impressions: 1000, position: 4 }),
        row({ keys: ['/severe'], clicks: 100, impressions: 1000, position: 4 }),
      ],
      [
        row({ keys: ['/mild'], clicks: 70, impressions: 900, position: 5 }),
        row({ keys: ['/severe'], clicks: 10, impressions: 800, position: 20 }),
      ],
    );
    expect(findDecay(deltas, DEFAULT_DECAY_OPTIONS).map((d) => d.key)).toEqual([
      '/severe',
      '/mild',
    ]);
  });
});

describe('findCannibalization', () => {
  it('groups a query that two pages both rank for', () => {
    const groups = findCannibalization(
      [
        row({ keys: ['running shoes', '/guide'], clicks: 5, impressions: 400, position: 12 }),
        row({ keys: ['running shoes', '/product'], clicks: 30, impressions: 600, position: 4 }),
      ],
      DEFAULT_CANNIBAL_OPTIONS,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.query).toBe('running shoes');
    expect(groups[0]?.pages.map((p) => p.page)).toEqual(['/product', '/guide']);
    expect(groups[0]?.totalImpressions).toBe(1000);
  });

  it('picks the best-ranking page, not the one with the most clicks', () => {
    const groups = findCannibalization(
      [
        // More clicks, far worse rank.
        row({ keys: ['boots', '/blog'], clicks: 90, impressions: 5000, position: 28 }),
        row({ keys: ['boots', '/shop'], clicks: 20, impressions: 300, position: 3 }),
      ],
      DEFAULT_CANNIBAL_OPTIONS,
    );
    expect(groups[0]?.strongestPage).toBe('/shop');
    expect(groups[0]?.strongestPageReason).toContain('best average position');
  });

  it('ignores a query only one page ranks for', () => {
    const groups = findCannibalization(
      [row({ keys: ['solo', '/only'], clicks: 10, impressions: 500, position: 2 })],
      DEFAULT_CANNIBAL_OPTIONS,
    );
    expect(groups).toEqual([]);
  });

  it('applies the impression threshold per page, not per query', () => {
    // /main is strong; /noise is long-tail dust. Thresholding the query total would
    // wrongly report this as cannibalisation.
    const groups = findCannibalization(
      [
        row({ keys: ['widgets', '/main'], clicks: 40, impressions: 900, position: 3 }),
        row({ keys: ['widgets', '/noise'], clicks: 0, impressions: 2, position: 88 }),
      ],
      DEFAULT_CANNIBAL_OPTIONS,
    );
    expect(groups).toEqual([]);
  });

  it('skips rows missing the page dimension', () => {
    expect(() =>
      findCannibalization([row({ keys: ['query-only'] })], DEFAULT_CANNIBAL_OPTIONS),
    ).not.toThrow();
  });

  it('ranks groups by total impressions and honours the limit', () => {
    const rows = [
      row({ keys: ['small', '/a'], impressions: 100, position: 5 }),
      row({ keys: ['small', '/b'], impressions: 100, position: 9 }),
      row({ keys: ['big', '/c'], impressions: 5000, position: 4 }),
      row({ keys: ['big', '/d'], impressions: 4000, position: 8 }),
    ];
    expect(findCannibalization(rows, DEFAULT_CANNIBAL_OPTIONS)[0]?.query).toBe('big');
    expect(findCannibalization(rows, { ...DEFAULT_CANNIBAL_OPTIONS, limit: 1 })).toHaveLength(1);
  });
});
