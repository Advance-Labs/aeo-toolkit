import { describe, expect, it } from 'vitest';

import { classifyDivergence, fractionalDelta } from './divergence.js';
import { buildCoverage, mergeEngineRows } from './normalize.js';

const OPTS = { threshold: 0.3, minClicks: 50 };

describe('fractionalDelta', () => {
  it('is negative for a drop', () => {
    expect(fractionalDelta(100, 50)).toBeCloseTo(-0.5, 10);
  });

  it('is positive for a rise', () => {
    expect(fractionalDelta(100, 150)).toBeCloseTo(0.5, 10);
  });

  it('is null from a zero baseline rather than Infinity', () => {
    expect(fractionalDelta(0, 10)).toBeNull();
  });

  it('is null from a negative baseline', () => {
    expect(fractionalDelta(-5, 10)).toBeNull();
  });

  it('is null from a non-finite baseline (NaN or Infinity)', () => {
    expect(fractionalDelta(Number.NaN, 10)).toBeNull();
    expect(fractionalDelta(Number.POSITIVE_INFINITY, 10)).toBeNull();
  });
});

describe('classifyDivergence', () => {
  it('is google_specific when Google drops and Bing holds', () => {
    expect(
      classifyDivergence(
        { googleDelta: -0.6, bingDelta: -0.05, googleBaseClicks: 500, bingBaseClicks: 200 },
        OPTS,
      ),
    ).toBe('google_specific');
  });

  it('is bing_specific when Bing drops and Google holds', () => {
    expect(
      classifyDivergence(
        { googleDelta: 0.02, bingDelta: -0.7, googleBaseClicks: 500, bingBaseClicks: 200 },
        OPTS,
      ),
    ).toBe('bing_specific');
  });

  it('is broad when both drop past the threshold', () => {
    expect(
      classifyDivergence(
        { googleDelta: -0.5, bingDelta: -0.45, googleBaseClicks: 500, bingBaseClicks: 200 },
        OPTS,
      ),
    ).toBe('broad');
  });

  it('is insufficient_data when neither moves past the threshold', () => {
    expect(
      classifyDivergence(
        { googleDelta: -0.05, bingDelta: 0.01, googleBaseClicks: 500, bingBaseClicks: 200 },
        OPTS,
      ),
    ).toBe('insufficient_data');
  });

  it('insufficient_data WINS over a would-be google_specific on a thin baseline', () => {
    // A 100% drop from two clicks is noise. Classifying it manufactures a finding.
    expect(
      classifyDivergence(
        { googleDelta: -1, bingDelta: 0, googleBaseClicks: 2, bingBaseClicks: 200 },
        OPTS,
      ),
    ).toBe('insufficient_data');
  });

  it('insufficient_data wins when the Bing baseline is thin', () => {
    expect(
      classifyDivergence(
        { googleDelta: -0.6, bingDelta: -0.05, googleBaseClicks: 500, bingBaseClicks: 3 },
        OPTS,
      ),
    ).toBe('insufficient_data');
  });

  it('is insufficient_data when either delta is null', () => {
    expect(
      classifyDivergence(
        { googleDelta: null, bingDelta: -0.6, googleBaseClicks: 500, bingBaseClicks: 200 },
        OPTS,
      ),
    ).toBe('insufficient_data');
  });

  it('honours a custom threshold', () => {
    expect(
      classifyDivergence(
        { googleDelta: -0.15, bingDelta: 0, googleBaseClicks: 500, bingBaseClicks: 200 },
        { threshold: 0.1, minClicks: 50 },
      ),
    ).toBe('google_specific');
  });

  it('treats a rise on one engine as not-a-drop, never as a divergence', () => {
    expect(
      classifyDivergence(
        { googleDelta: 0.9, bingDelta: 0.8, googleBaseClicks: 500, bingBaseClicks: 200 },
        OPTS,
      ),
    ).toBe('insufficient_data');
  });
});

describe('zero-fill guard', () => {
  it('a merged row for an absent engine serializes as null, never as zeroes', () => {
    const merged = mergeEngineRows(
      [{ key: 'a', clicks: 5, impressions: 50, ctr: 0.1, position: 4 }],
      null,
    );
    const json = JSON.stringify(merged);
    expect(json).toContain('"bing":null');
    expect(json).not.toMatch(/"bing":\{[^}]*"clicks":0/);
  });

  it('an unavailable engine reports a reason, not a rowCount that implies data', () => {
    const cov = buildCoverage({
      google: { rows: [], error: null },
      bing: { rows: null, error: 'no api key' },
    });
    expect(cov.bing.available).toBe(false);
    expect(cov.bing.reason).toBe('no api key');
  });
});
