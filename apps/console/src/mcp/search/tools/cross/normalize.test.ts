import { describe, expect, it } from 'vitest';
import {
  BING_WINDOW_NOTE,
  bucketBingQueriesByDate,
  buildCoverage,
  mergeEngineRows,
  normalizeBingQueries,
  normalizeGscRows,
  POSITION_MAPPING_NOTE,
  type EngineRow,
} from './normalize.js';

const bingRow = {
  query: 'aeo tools',
  clicks: 10,
  impressions: 200,
  avgClickPosition: 3.1,
  avgImpressionPosition: 8.4,
  date: null,
};

describe('normalizeBingQueries', () => {
  it('maps avgImpressionPosition — not avgClickPosition — onto position', () => {
    expect(normalizeBingQueries([bingRow])[0]!.position).toBe(8.4);
  });

  it('computes ctr from clicks over impressions', () => {
    expect(normalizeBingQueries([bingRow])[0]!.ctr).toBeCloseTo(0.05, 10);
  });

  it('yields a null ctr on zero impressions rather than dividing by zero', () => {
    const row = normalizeBingQueries([{ ...bingRow, clicks: 0, impressions: 0 }])[0]!;
    expect(row.ctr).toBeNull();
  });

  it('yields a null position when Bing reports 0, which means "no data"', () => {
    const row = normalizeBingQueries([{ ...bingRow, avgImpressionPosition: 0 }])[0]!;
    expect(row.position).toBeNull();
  });
});

const gscRow = {
  keys: ['aeo tools'],
  clicks: 10,
  impressions: 200,
  ctr: 0.05,
  position: 8.4,
};

describe('normalizeGscRows', () => {
  it('maps keys[0] onto key', () => {
    expect(normalizeGscRows([gscRow])[0]!.key).toBe('aeo tools');
  });

  it('computes ctr from clicks over impressions', () => {
    expect(normalizeGscRows([gscRow])[0]!.ctr).toBeCloseTo(0.05, 10);
  });

  it('yields a null ctr on zero impressions rather than reading the supplied ctr', () => {
    const row = normalizeGscRows([{ ...gscRow, clicks: 0, impressions: 0, ctr: 0.5 }])[0]!;
    expect(row.ctr).toBeNull();
  });

  it('yields a null position when Google reports 0, which means "no data"', () => {
    const row = normalizeGscRows([{ ...gscRow, position: 0 }])[0]!;
    expect(row.position).toBeNull();
  });
});

describe('mergeEngineRows', () => {
  const g: EngineRow = { key: 'a', clicks: 5, impressions: 50, ctr: 0.1, position: 4 };
  const b: EngineRow = { key: 'b', clicks: 7, impressions: 70, ctr: 0.1, position: 9 };

  it('pairs rows that share a key', () => {
    const merged = mergeEngineRows([g], [{ ...b, key: 'a' }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.google).not.toBeNull();
    expect(merged[0]!.bing).not.toBeNull();
  });

  it('uses null — NEVER zero — for an engine that has no row for a key', () => {
    const merged = mergeEngineRows([g], [b]);
    const onlyGoogle = merged.find((r) => r.key === 'a')!;
    expect(onlyGoogle.bing).toBeNull();
    expect(JSON.stringify(onlyGoogle)).not.toContain('"clicks":0');
  });

  it('treats a wholly absent engine as null rather than an empty set', () => {
    const merged = mergeEngineRows([g], null);
    expect(merged[0]!.bing).toBeNull();
  });
});

describe('buildCoverage', () => {
  it('records the position mapping as a note whenever Bing supplied rows', () => {
    const cov = buildCoverage({
      google: { rows: [], error: null },
      bing: { rows: [], error: null },
    });
    expect(cov.notes).toContain(POSITION_MAPPING_NOTE);
  });

  it('marks an engine unavailable and carries its reason', () => {
    const cov = buildCoverage({
      google: { rows: [], error: null },
      bing: { rows: null, error: 'no api key' },
    });
    expect(cov.bing.available).toBe(false);
    expect(cov.bing.reason).toBe('no api key');
  });

  it('leaves reason null for an available engine', () => {
    const cov = buildCoverage({
      google: { rows: [], error: null },
      bing: { rows: [], error: null },
    });
    expect(cov.google.reason).toBeNull();
  });

  it('omits the position note when Bing is unavailable', () => {
    const cov = buildCoverage({
      google: { rows: [], error: null },
      bing: { rows: null, error: 'down' },
    });
    expect(cov.notes).not.toContain(POSITION_MAPPING_NOTE);
  });

  it('records the Bing-is-unwindowed note whenever Bing supplied rows', () => {
    const cov = buildCoverage({
      google: { rows: [], error: null },
      bing: { rows: [], error: null },
    });
    expect(cov.notes).toContain(BING_WINDOW_NOTE);
  });

  it('omits the Bing-is-unwindowed note when Bing is unavailable', () => {
    const cov = buildCoverage({
      google: { rows: [], error: null },
      bing: { rows: null, error: 'down' },
    });
    expect(cov.notes).not.toContain(BING_WINDOW_NOTE);
  });
});

describe('bucketBingQueriesByDate', () => {
  const row = (query: string, date: string | null, clicks: number) => ({
    query,
    clicks,
    impressions: clicks * 10,
    avgClickPosition: null,
    avgImpressionPosition: 4,
    date,
  });

  it('includes both window edges and excludes what falls outside', () => {
    const rows = [
      row('q', '2026-01-01T00:00:00.000Z', 1), // start edge, in
      row('q', '2026-01-03T00:00:00.000Z', 2), // middle, in
      row('q', '2026-01-05T00:00:00.000Z', 4), // end edge, in
      row('q', '2026-01-06T00:00:00.000Z', 8), // past the end, out
      row('q', '2025-12-31T00:00:00.000Z', 16), // before the start, out
    ];
    const out = bucketBingQueriesByDate(rows, {
      startDate: '2026-01-01',
      endDate: '2026-01-05',
    });
    // 1 + 2 + 4; the powers of two make an off-by-one edge failure unambiguous.
    expect(out.rows).toEqual([
      { key: 'q', clicks: 7, impressions: 70, ctr: 0.1, position: null },
    ]);
  });

  it('counts undated rows separately instead of folding them into the window', () => {
    const out = bucketBingQueriesByDate(
      [row('q', null, 99), row('q', '2026-01-02T00:00:00.000Z', 5)],
      { startDate: '2026-01-01', endDate: '2026-01-05' },
    );
    expect(out.undated).toBe(1);
    expect(out.dated).toBe(1);
    expect(out.rows[0]?.clicks).toBe(5);
  });

  it('reports dated=0 when nothing can be attributed, so the caller can bail', () => {
    const out = bucketBingQueriesByDate([row('q', null, 99)], {
      startDate: '2026-01-01',
      endDate: '2026-01-05',
    });
    expect(out.dated).toBe(0);
    expect(out.rows).toEqual([]);
  });

  it('never fabricates a position when aggregating across dates', () => {
    const out = bucketBingQueriesByDate(
      [row('q', '2026-01-01T00:00:00.000Z', 1), row('q', '2026-01-02T00:00:00.000Z', 1)],
      { startDate: '2026-01-01', endDate: '2026-01-05' },
    );
    // Averaging an average without impression weights would invent a number.
    expect(out.rows[0]?.position).toBeNull();
  });
});
