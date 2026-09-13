import { describe, expect, it, vi } from 'vitest';
import { McpToolError } from '@advance-labs/mcp-core';
import type { GscReport } from '@advance-labs/types';

import { BingKeyResolver, InMemoryBingKeyStore } from '../../auth/bing.js';
import type { BingLike, ClientFactory, GscLike, ToolContext } from '../context.js';
import { compareEngines, engineDivergence } from './handlers.js';

/** A ToolContext with mocked GSC/Bing clients, so `engine_divergence` never hits the network. */
function ctxWithEngines(opts: { gsc?: Partial<GscLike>; bing?: Partial<BingLike> }): ToolContext {
  const gsc: GscLike = {
    query: opts.gsc?.query ?? (async (): Promise<GscReport> => ({ rows: [] })),
    listSites: opts.gsc?.listSites ?? (async () => []),
  };
  const bing: BingLike = {
    listSites: opts.bing?.listSites ?? (async () => []),
    getRankAndTrafficStats: opts.bing?.getRankAndTrafficStats ?? (async () => []),
    getQueryStats: opts.bing?.getQueryStats ?? (async () => []),
    getPageStats: opts.bing?.getPageStats ?? (async () => []),
    getQueryPageStats: opts.bing?.getQueryPageStats ?? (async () => []),
    getPageQueryStats: opts.bing?.getPageQueryStats ?? (async () => []),
    getCrawlStats: opts.bing?.getCrawlStats ?? (async () => []),
    getCrawlIssues: opts.bing?.getCrawlIssues ?? (async () => []),
    getUrlInfo: opts.bing?.getUrlInfo ?? (async () => null as never),
    getUrlSubmissionQuota: opts.bing?.getUrlSubmissionQuota ?? (async () => null as never),
    getKeywordStats: opts.bing?.getKeywordStats ?? (async () => []),
    getRelatedKeywords: opts.bing?.getRelatedKeywords ?? (async () => []),
  };
  const clients: ClientFactory = {
    ga4: vi.fn(),
    gsc: () => gsc,
    bing: () => bing,
  } as never;
  return {
    tokens: { resolveAccessToken: async () => 't' } as ToolContext['tokens'],
    bingKeys: new BingKeyResolver({ store: new InMemoryBingKeyStore(), staticApiKey: 'k' }),
    clients,
    userId: 'u1',
    requestToken: null,
    requestBingKey: null,
  };
}

/** Narrow a `ToolResult` to its structured payload, failing the test if it errored. */
function payload(result: { isError?: boolean; structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  expect(result.isError).toBeFalsy();
  return result.structuredContent ?? {};
}

describe('compareEngines truncation', () => {
  it('keeps a high-click Bing-only row over a low-click Google row under a small limit', async () => {
    // Google returns two low-click rows first; Bing returns one high-click row
    // for a key Google never saw. Insertion order alone would put both Google
    // rows ahead of the Bing-only row and truncate it away at limit=1.
    const ctx = ctxWithEngines({
      gsc: {
        query: async (): Promise<GscReport> => ({
          rows: [
            { keys: ['low-a'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 },
            { keys: ['low-b'], clicks: 2, impressions: 20, ctr: 0.1, position: 5 },
          ],
        }),
      },
      bing: {
        getQueryStats: async () => [
          {
            query: 'bing-big',
            clicks: 500,
            impressions: 5000,
            avgClickPosition: 2,
            avgImpressionPosition: 3,
            date: null,
          },
        ],
      },
    });

    const result = await compareEngines(ctx, {
      siteUrl: 'sc-domain:example.com',
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      limit: 1,
    });

    const out = payload(result as never);
    const rows = out['rows'] as { key: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toBe('bing-big');
  });

  it('computes the both-engines count from the full merged set, not the truncated slice', async () => {
    const ctx = ctxWithEngines({
      gsc: {
        query: async (): Promise<GscReport> => ({
          rows: [
            { keys: ['shared'], clicks: 3, impressions: 30, ctr: 0.1, position: 5 },
            { keys: ['google-only'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 },
          ],
        }),
      },
      bing: {
        getQueryStats: async () => [
          {
            query: 'shared',
            clicks: 4,
            impressions: 40,
            avgClickPosition: 2,
            avgImpressionPosition: 3,
            date: null,
          },
          {
            query: 'bing-only',
            clicks: 500,
            impressions: 5000,
            avgClickPosition: 2,
            avgImpressionPosition: 3,
            date: null,
          },
        ],
      },
    });

    const result = await compareEngines(ctx, {
      siteUrl: 'sc-domain:example.com',
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      limit: 1,
    });

    const out = payload(result as never);
    const text = (result as { content: { text: string }[] }).content[0]?.text ?? '';
    // The full merged set has exactly one key ('shared') present on both engines,
    // even though the truncated `rows` (limit=1) contains only 'bing-only'.
    expect(text).toMatch(/1 of 3 present on both engines/);
    const rows = out['rows'] as { key: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toBe('bing-only');
  });
});

describe('engineDivergence range guard', () => {
  it('throws for a same-day range, which would split into an inverted empty half', async () => {
    const ctx = ctxWithEngines({});
    await expect(
      engineDivergence(ctx, {
        siteUrl: 'sc-domain:example.com',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        limit: 100,
        threshold: 0.3,
        minClicks: 50,
      }),
    ).rejects.toThrow(McpToolError);
    await expect(
      engineDivergence(ctx, {
        siteUrl: 'sc-domain:example.com',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        limit: 100,
        threshold: 0.3,
        minClicks: 50,
      }),
    ).rejects.toThrow(/at least a 2-day range/);
  });

  it('does not throw for a 2-day range', async () => {
    const ctx = ctxWithEngines({});
    const result = await engineDivergence(ctx, {
      siteUrl: 'sc-domain:example.com',
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      limit: 100,
      threshold: 0.3,
      minClicks: 50,
    });
    expect(result.isError).toBeFalsy();
  });
});

/**
 * The two defects that kept `engine_divergence` unregistered until 2026-09-09.
 * Both are behavioural, so both are pinned here rather than left to the docblocks.
 */
describe('engineDivergence: the two defects that blocked registration', () => {
  const dated = (query: string, date: string, clicks: number) => ({
    query,
    clicks,
    impressions: clicks * 10,
    avgClickPosition: null,
    avgImpressionPosition: 4,
    date,
  });

  it('buckets one unwindowed Bing fetch into halves instead of fetching twice', async () => {
    // DEFECT 1. GetQueryStats takes no date parameter, so the old code fetched it
    // twice and got the identical aggregate both times — bingDelta was always 0 and
    // `broad` was unreachable. Bing must be asked exactly ONCE, then split locally.
    const getQueryStats = vi.fn(async () => [
      // Baseline half (Jan 1-3): 100 clicks. Current half (Jan 4-6): 10 clicks.
      dated('shared', '2026-01-01T00:00:00.000Z', 100),
      dated('shared', '2026-01-05T00:00:00.000Z', 10),
    ]);
    const ctx = ctxWithEngines({
      gsc: {
        query: async (opts: { startDate: string }): Promise<GscReport> => ({
          rows: [
            {
              keys: ['shared'],
              clicks: opts.startDate === '2026-01-01' ? 100 : 10,
              impressions: 1000,
              ctr: 0.1,
              position: 3,
            },
          ],
        }),
      },
      bing: { getQueryStats },
    });

    const out = payload(
      await engineDivergence(ctx, {
        siteUrl: 'sc-domain:example.com',
        startDate: '2026-01-01',
        endDate: '2026-01-06',
        threshold: 0.3,
        minClicks: 50,
        limit: 100,
      } as never),
    );

    expect(getQueryStats).toHaveBeenCalledTimes(1);
    const findings = out['findings'] as { key: string; classification: string }[];
    // Both engines dropped ~90%, so this is `broad` — the classification that was
    // structurally unreachable before the fix.
    expect(findings[0]?.classification).toBe('broad');
  });

  it('reports insufficient_data, not bing_specific, when Bing fails outright', async () => {
    // DEFECT 2. A failed engine used to zero-fill via `?? 0`, which is
    // indistinguishable from Bing genuinely reporting no clicks — and a Google-side
    // drop against a fabricated Bing zero manufactures a confident verdict.
    const ctx = ctxWithEngines({
      gsc: {
        query: async (opts: { startDate: string }): Promise<GscReport> => ({
          rows: [
            {
              keys: ['shared'],
              clicks: opts.startDate === '2026-01-01' ? 100 : 10,
              impressions: 1000,
              ctr: 0.1,
              position: 3,
            },
          ],
        }),
      },
      bing: {
        getQueryStats: async () => {
          throw new Error('bing exploded');
        },
      },
    });

    const out = payload(
      await engineDivergence(ctx, {
        siteUrl: 'sc-domain:example.com',
        startDate: '2026-01-01',
        endDate: '2026-01-06',
        threshold: 0.3,
        minClicks: 50,
        limit: 100,
      } as never),
    );

    const counts = out['counts'] as Record<string, number>;
    expect(counts['insufficient_data']).toBeGreaterThan(0);
    expect(counts['google_specific']).toBe(0);
    expect(counts['bing_specific']).toBe(0);
    expect(counts['broad']).toBe(0);

    const coverage = out['coverage'] as { bing: { available: boolean; reason: string | null } };
    expect(coverage.bing.available).toBe(false);
    expect(coverage.bing.reason).toContain('bing exploded');
  });

  it('treats a wholly-undated Bing response as unavailable, not as zero clicks', async () => {
    // The same zero-fill trap by a different route: rows arrive, but none can be
    // attributed to a half. Counting them as 0 would fabricate a Bing collapse.
    const ctx = ctxWithEngines({
      gsc: {
        query: async (opts: { startDate: string }): Promise<GscReport> => ({
          rows: [
            {
              keys: ['shared'],
              clicks: opts.startDate === '2026-01-01' ? 100 : 10,
              impressions: 1000,
              ctr: 0.1,
              position: 3,
            },
          ],
        }),
      },
      bing: {
        getQueryStats: async () => [
          { ...dated('shared', '2026-01-01T00:00:00.000Z', 100), date: null },
        ],
      },
    });

    const out = payload(
      await engineDivergence(ctx, {
        siteUrl: 'sc-domain:example.com',
        startDate: '2026-01-01',
        endDate: '2026-01-06',
        threshold: 0.3,
        minClicks: 50,
        limit: 100,
      } as never),
    );

    const coverage = out['coverage'] as { bing: { available: boolean; reason: string | null } };
    expect(coverage.bing.available).toBe(false);
    expect(coverage.bing.reason).toContain('none carried a date');
    expect((out['counts'] as Record<string, number>)['bing_specific']).toBe(0);
  });
});
