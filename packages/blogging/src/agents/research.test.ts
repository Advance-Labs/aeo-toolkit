import { describe, expect, it, vi } from 'vitest';
import type { GscQueryRequest, GscReport, GscRow } from '@aeo/types';
import type { GscQueryFn } from '../google/gsc.js';
import type { Strategy } from '../types.js';
import { fingerprint } from './dedup.js';
import { findQueryGaps, runResearch, scoreGap, DEFAULT_GAP_THRESHOLDS } from './research.js';

function row(partial: Partial<GscRow> & { keys: string[] }): GscRow {
  return {
    keys: partial.keys,
    clicks: partial.clicks ?? 0,
    impressions: partial.impressions ?? 0,
    ctr: partial.ctr ?? 0,
    position: partial.position ?? 0,
  };
}

const STRATEGY: Strategy = {
  siteUrl: 'https://example.com',
  pillars: ['answer engine optimization', 'seo'],
  competitors: [],
  audience: 'SEO practitioners',
  voice: 'practical',
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('scoreGap', () => {
  it('scores weak-position high-impression queries above well-ranked ones', () => {
    const weak = scoreGap(
      row({ keys: ['x'], impressions: 5000, position: 14, ctr: 0.01 }),
      DEFAULT_GAP_THRESHOLDS,
    );
    const strong = scoreGap(
      row({ keys: ['y'], impressions: 5000, position: 1.2, ctr: 0.4 }),
      DEFAULT_GAP_THRESHOLDS,
    );
    expect(weak).toBeGreaterThan(strong);
  });
});

describe('findQueryGaps', () => {
  it('keeps weak-position or low-CTR rows above the impression floor, ranked by score', () => {
    const report: GscReport = {
      rows: [
        row({ keys: ['gap-weak-pos'], impressions: 800, position: 12, ctr: 0.03 }),
        row({ keys: ['gap-low-ctr'], impressions: 600, position: 4, ctr: 0.005 }),
        row({ keys: ['winner'], impressions: 900, position: 1.1, ctr: 0.5 }),
        row({ keys: ['too-few-impr'], impressions: 10, position: 30, ctr: 0 }),
        row({ keys: [''], impressions: 1000, position: 20, ctr: 0 }), // no query -> skipped
      ],
    };
    const gaps = findQueryGaps(report);
    const queries = gaps.map((g) => g.query);
    expect(queries).toContain('gap-weak-pos');
    expect(queries).toContain('gap-low-ctr');
    expect(queries).not.toContain('winner');
    expect(queries).not.toContain('too-few-impr');
    expect(queries).not.toContain('');
    // Sorted descending by score.
    for (let i = 1; i < gaps.length; i += 1) {
      expect((gaps[i - 1]?.score ?? 0) >= (gaps[i]?.score ?? 0)).toBe(true);
    }
  });
});

describe('runResearch', () => {
  it('queries GSC and emits deduped briefs, skipping near-duplicates of the corpus', async () => {
    const report: GscReport = {
      rows: [
        row({
          keys: ['answer engine optimization guide'],
          impressions: 1000,
          position: 11,
          ctr: 0.01,
        }),
        row({ keys: ['seo basics tutorial'], impressions: 700, position: 9, ctr: 0.008 }),
      ],
    };
    let captured: GscQueryRequest | undefined;
    const query: GscQueryFn = vi.fn((req: GscQueryRequest): Promise<GscReport> => {
      captured = req;
      return Promise.resolve(report);
    });

    // Pre-seed the corpus with a near-duplicate of the first gap's brief text.
    const corpus = [
      {
        slug: 'answer-engine-optimization-guide',
        fingerprint: fingerprint(
          'Answer Engine Optimization Guide answer engine optimization guide Capture organic demand for "answer engine optimization guide" by closing a Search Console gap',
        ),
      },
    ];

    const briefs = await runResearch(
      {
        strategy: STRATEGY,
        gscSiteUrl: 'https://example.com/',
        startDate: '2026-05-01',
        endDate: '2026-05-28',
        corpus,
        dedupThreshold: 0.6,
        limit: 5,
      },
      query,
    );

    expect(captured?.dimensions).toEqual(['query']);
    const slugs = briefs.map((b) => b.slug);
    // The near-duplicate AEO brief is dropped; the unrelated SEO one survives.
    expect(slugs).toContain('seo-basics-tutorial');
    expect(slugs).not.toContain('answer-engine-optimization-guide');
  });

  it('respects the brief limit', async () => {
    const report: GscReport = {
      rows: [
        row({ keys: ['alpha topic'], impressions: 900, position: 12 }),
        row({ keys: ['beta topic'], impressions: 800, position: 13 }),
        row({ keys: ['gamma topic'], impressions: 700, position: 14 }),
      ],
    };
    const query: GscQueryFn = () => Promise.resolve(report);
    const briefs = await runResearch(
      {
        strategy: STRATEGY,
        gscSiteUrl: 'https://example.com/',
        startDate: '2026-05-01',
        endDate: '2026-05-28',
        corpus: [],
        dedupThreshold: 0.8,
        limit: 2,
      },
      query,
    );
    expect(briefs).toHaveLength(2);
  });
});
