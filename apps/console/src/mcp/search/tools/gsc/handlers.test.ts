import { describe, expect, it, vi } from 'vitest';
import type { ToolResult, ToolSuccessResult } from '@advance-labs/mcp-core';
import type {
  Ga4Report,
  GscReport,
  GscSite,
  GscUrlInspection,
  Ga4Property,
} from '@advance-labs/types';

import type { ClientFactory, Ga4Like, GscLike, ToolContext } from '../context.js';
import {
  comparePeriodsTool,
  ga4RunReport,
  gscCtrGaps,
  gscSearchAnalytics,
  gscTopQueries,
  listGa4Properties,
  listGscSites,
  gscTrafficDrop,
  gscCannibalization,
  gscDecay,
  gscUrlInspect,
} from './handlers.js';

const emptyInspection: GscUrlInspection = {
  verdict: 'PASS',
  coverageState: 'Submitted and indexed',
  indexingState: '',
  robotsTxtState: '',
  pageFetchState: '',
  lastCrawlTime: '2026-10-01T00:00:00Z',
  googleCanonical: 'https://x.com/a',
  userCanonical: 'https://x.com/a',
  sitemap: [],
  referringUrlCount: 0,
};

/** Narrow a `ToolResult` to its success arm, failing the test if it is an error. */
function expectSuccess(result: ToolResult): ToolSuccessResult {
  expect(result.isError).toBeFalsy();
  if (result.isError === true) {
    throw new Error(`expected a success ToolResult, got error: ${result.content[0]?.text ?? ''}`);
  }
  return result;
}

/** A token resolver test double that returns a fixed token and records the call. */
function fakeResolver(token = 'tok-123') {
  const resolveAccessToken = vi.fn(async () => token);
  return {
    resolver: { resolveAccessToken } as unknown as ToolContext['tokens'],
    resolveAccessToken,
  };
}

function makeCtx(opts: {
  ga4?: Partial<Ga4Like>;
  gsc?: Partial<GscLike>;
  token?: string;
  requestToken?: string | null;
}): {
  ctx: ToolContext;
  ga4Factory: ReturnType<typeof vi.fn>;
  gscFactory: ReturnType<typeof vi.fn>;
} {
  const ga4: Ga4Like = {
    runReport:
      opts.ga4?.runReport ?? vi.fn(async (): Promise<Ga4Report> => ({ rows: [], rowCount: 0 })),
    listProperties: opts.ga4?.listProperties ?? vi.fn(async (): Promise<Ga4Property[]> => []),
  };
  const gsc: GscLike = {
    query: opts.gsc?.query ?? vi.fn(async (): Promise<GscReport> => ({ rows: [] })),
    listSites: opts.gsc?.listSites ?? vi.fn(async (): Promise<GscSite[]> => []),
    inspectUrl:
      opts.gsc?.inspectUrl ?? vi.fn(async (): Promise<GscUrlInspection> => emptyInspection),
  };
  const ga4Factory = vi.fn((_token: string) => ga4);
  const gscFactory = vi.fn((_token: string) => gsc);
  const clients: ClientFactory = { ga4: ga4Factory, gsc: gscFactory, bing: vi.fn() };
  const { resolver } = fakeResolver(opts.token);
  const ctx: ToolContext = {
    tokens: resolver,
    bingKeys: {} as unknown as ToolContext['bingKeys'],
    clients,
    userId: 'u1',
    requestToken: opts.requestToken ?? null,
  };
  return { ctx, ga4Factory, gscFactory };
}

describe('listGscSites', () => {
  it('returns sites in structuredContent', async () => {
    const listSites = vi.fn(
      async (): Promise<GscSite[]> => [{ siteUrl: 'https://a.com/', permissionLevel: 'siteOwner' }],
    );
    const { ctx } = makeCtx({ gsc: { listSites } });
    const res = expectSuccess(await listGscSites(ctx));
    expect(res.structuredContent).toMatchObject({ sites: [{ siteUrl: 'https://a.com/' }] });
    expect(listSites).toHaveBeenCalledOnce();
  });
});

describe('listGa4Properties', () => {
  it('notes the upstream stub when empty', async () => {
    const { ctx } = makeCtx({});
    const res = await listGa4Properties(ctx);
    expect(res.content[0]?.text).toContain('stub');
  });
});

describe('ga4RunReport', () => {
  it('forwards the request and surfaces rowCount', async () => {
    const runReport = vi.fn<Ga4Like['runReport']>(async () => ({
      rows: [{ dimensions: { date: '20240101' }, metrics: { screenPageViews: 42 } }],
      rowCount: 1,
    }));
    const { ctx } = makeCtx({ ga4: { runReport } });
    const res = expectSuccess(
      await ga4RunReport(ctx, {
        propertyId: '123',
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
        dimensions: ['date'],
        metrics: ['screenPageViews'],
      }),
    );
    expect(runReport).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: '123', metrics: ['screenPageViews'] }),
    );
    expect(res.structuredContent).toMatchObject({ rowCount: 1 });
  });

  it('omits limit when not provided', async () => {
    const runReport = vi.fn<Ga4Like['runReport']>(async () => ({ rows: [], rowCount: 0 }));
    const { ctx } = makeCtx({ ga4: { runReport } });
    await ga4RunReport(ctx, {
      propertyId: '1',
      dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-02' }],
      dimensions: [],
      metrics: ['totalUsers'],
    });
    expect(runReport.mock.calls[0]?.[0]).not.toHaveProperty('limit');
  });
});

describe('gscSearchAnalytics', () => {
  it('only sends dimensions when non-empty', async () => {
    const query = vi.fn<GscLike['query']>(async () => ({ rows: [] }));
    const { ctx } = makeCtx({ gsc: { query } });
    await gscSearchAnalytics(ctx, {
      siteUrl: 'https://x.com/',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      dimensions: [],
    });
    expect(query.mock.calls[0]?.[0]).not.toHaveProperty('dimensions');
  });
});

describe('gscTopQueries', () => {
  it('queries with the query dimension and ranks by clicks', async () => {
    const query = vi.fn<GscLike['query']>(async () => ({
      rows: [
        { keys: ['low'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 },
        { keys: ['high'], clicks: 100, impressions: 500, ctr: 0.2, position: 2 },
      ],
    }));
    const { ctx } = makeCtx({ gsc: { query } });
    const res = expectSuccess(
      await gscTopQueries(ctx, { siteUrl: 'https://x.com/', days: 28, limit: 1 }),
    );
    expect(query.mock.calls[0]?.[0]).toMatchObject({ dimensions: ['query'] });
    expect(res.structuredContent).toMatchObject({ queries: [{ query: 'high' }] });
  });
});

describe('gscCtrGaps', () => {
  it('returns only high-impression low-CTR rows', async () => {
    const query = vi.fn<GscLike['query']>(async () => ({
      rows: [
        { keys: ['gap'], clicks: 2, impressions: 1000, ctr: 0.002, position: 8 },
        { keys: ['fine'], clicks: 50, impressions: 200, ctr: 0.25, position: 1 },
      ],
    }));
    const { ctx } = makeCtx({ gsc: { query } });
    const res = expectSuccess(
      await gscCtrGaps(ctx, {
        siteUrl: 'https://x.com/',
        days: 28,
        minImpressions: 100,
        maxCtr: 0.02,
        limit: 25,
      }),
    );
    const structured = res.structuredContent as { gaps: { query: string }[] };
    expect(structured.gaps.map((g) => g.query)).toEqual(['gap']);
  });
});

describe('comparePeriodsTool', () => {
  it('aggregates both periods and reports deltas', async () => {
    const query = vi
      .fn<(...args: unknown[]) => Promise<GscReport>>()
      .mockResolvedValueOnce({
        rows: [{ keys: ['a'], clicks: 10, impressions: 100, ctr: 0.1, position: 4 }],
      })
      .mockResolvedValueOnce({
        rows: [{ keys: ['a'], clicks: 20, impressions: 100, ctr: 0.2, position: 2 }],
      });
    const { ctx } = makeCtx({ gsc: { query: query as unknown as GscLike['query'] } });
    const res = expectSuccess(
      await comparePeriodsTool(ctx, {
        siteUrl: 'https://x.com/',
        rangeA: { startDate: '2024-01-01', endDate: '2024-01-31' },
        rangeB: { startDate: '2024-02-01', endDate: '2024-02-29' },
      }),
    );
    expect(query).toHaveBeenCalledTimes(2);
    const structured = res.structuredContent as {
      comparison: { clicks: { delta: number }; position: { delta: number } };
    };
    expect(structured.comparison.clicks.delta).toBe(10);
    expect(structured.comparison.position.delta).toBe(-2);
  });
});

describe('BYOK request token precedence', () => {
  it('passes the request-scoped token through to the resolver', async () => {
    const resolveAccessToken = vi.fn(async () => 'resolved');
    const ga4: Ga4Like = {
      runReport: vi.fn(async (): Promise<Ga4Report> => ({ rows: [], rowCount: 0 })),
      listProperties: vi.fn(async (): Promise<Ga4Property[]> => []),
    };
    const ctx: ToolContext = {
      tokens: { resolveAccessToken } as unknown as ToolContext['tokens'],
      bingKeys: {} as unknown as ToolContext['bingKeys'],
      clients: {
        ga4: () => ga4,
        gsc: () => ({ query: vi.fn(), listSites: vi.fn() }) as unknown as GscLike,
        bing: vi.fn(),
      },
      userId: 'u1',
      requestToken: 'byok-abc',
    };
    await listGa4Properties(ctx);
    expect(resolveAccessToken).toHaveBeenCalledWith('u1', 'byok-abc');
  });
});

/** A GSC row builder for the diagnostic-handler tests. */
function gscRow(keys: string[], clicks: number, impressions: number, position = 5) {
  return { keys, clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position };
}

describe('gscTrafficDrop', () => {
  it('attributes the decline to the worst page and names it in the summary', async () => {
    const query = vi.fn<GscLike['query']>(async ({ startDate }): Promise<GscReport> => {
      // Baseline range fetched first; the handler distinguishes them only by date.
      return startDate === '2026-01-01'
        ? { rows: [gscRow(['/a'], 100, 1000, 3), gscRow(['/b'], 50, 500, 6)] }
        : { rows: [gscRow(['/a'], 20, 900, 9), gscRow(['/b'], 50, 500, 6)] };
    });
    const { ctx } = makeCtx({ gsc: { query } });
    const res = expectSuccess(
      await gscTrafficDrop(ctx, {
        siteUrl: 'https://a.com/',
        rangeA: { startDate: '2026-01-01', endDate: '2026-01-28' },
        rangeB: { startDate: '2026-02-01', endDate: '2026-02-28' },
        dimension: 'page',
        limit: 20,
      }),
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(res.structuredContent).toMatchObject({
      totalClicksLost: 80,
      decliningKeyCount: 1,
      contributors: [{ key: '/a', clicksDelta: -80, shareOfDecline: 1 }],
    });
    expect(res.content[0]?.text).toContain('/a');
  });

  it('says so plainly when nothing declined', async () => {
    const query = vi.fn<GscLike['query']>(async (): Promise<GscReport> => ({ rows: [] }));
    const { ctx } = makeCtx({ gsc: { query } });
    const res = expectSuccess(
      await gscTrafficDrop(ctx, {
        siteUrl: 'https://a.com/',
        rangeA: { startDate: '2026-01-01', endDate: '2026-01-28' },
        rangeB: { startDate: '2026-02-01', endDate: '2026-02-28' },
        dimension: 'page',
        limit: 20,
      }),
    );
    expect(res.content[0]?.text).toContain('No page lost clicks');
  });

  it('folds on queries when asked', async () => {
    const query = vi.fn<GscLike['query']>(async (): Promise<GscReport> => ({ rows: [] }));
    const { ctx } = makeCtx({ gsc: { query } });
    await gscTrafficDrop(ctx, {
      siteUrl: 'https://a.com/',
      rangeA: { startDate: '2026-01-01', endDate: '2026-01-28' },
      rangeB: { startDate: '2026-02-01', endDate: '2026-02-28' },
      dimension: 'query',
      limit: 20,
    });
    expect(query.mock.calls[0]?.[0]).toMatchObject({ dimensions: ['query'] });
  });
});

describe('gscCannibalization', () => {
  it('requests both dimensions and returns competing pages', async () => {
    const query = vi.fn<GscLike['query']>(
      async (): Promise<GscReport> => ({
        rows: [gscRow(['shoes', '/guide'], 5, 400, 12), gscRow(['shoes', '/shop'], 30, 600, 4)],
      }),
    );
    const { ctx } = makeCtx({ gsc: { query } });
    const res = expectSuccess(
      await gscCannibalization(ctx, {
        siteUrl: 'https://a.com/',
        days: 28,
        minImpressions: 50,
        limit: 25,
      }),
    );
    expect(query.mock.calls[0]?.[0]).toMatchObject({ dimensions: ['query', 'page'] });
    expect(res.structuredContent).toMatchObject({
      groups: [{ query: 'shoes', strongestPage: '/shop' }],
    });
  });

  it('frames overlap as evidence rather than a verdict', async () => {
    const { ctx } = makeCtx({});
    const res = expectSuccess(
      await gscCannibalization(ctx, {
        siteUrl: 'https://a.com/',
        days: 28,
        minImpressions: 50,
        limit: 25,
      }),
    );
    expect(res.content[0]?.text).toContain('not a verdict');
  });
});

describe('gscDecay', () => {
  it('compares two adjacent non-overlapping windows', async () => {
    const query = vi.fn<GscLike['query']>(async (): Promise<GscReport> => ({ rows: [] }));
    const { ctx } = makeCtx({ gsc: { query } });
    const res = expectSuccess(
      await gscDecay(ctx, {
        siteUrl: 'https://a.com/',
        windowDays: 28,
        minImpressions: 100,
        minDeclinePct: 0.2,
        limit: 25,
      }),
    );
    const structured = res.structuredContent as {
      recentWindow: { startDate: string };
      baselineWindow: { endDate: string };
    };
    // The baseline must end strictly before the recent window begins, or the
    // comparison damps the very decline it is meant to detect.
    expect(structured.baselineWindow.endDate < structured.recentWindow.startDate).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('flags a decaying page and reports whether it also lost rank', async () => {
    let call = 0;
    const query = vi.fn<GscLike['query']>(async (): Promise<GscReport> => {
      call += 1;
      // First call is the baseline window, second is the recent window.
      return call === 1
        ? { rows: [gscRow(['/old'], 100, 1000, 4)] }
        : { rows: [gscRow(['/old'], 20, 800, 11)] };
    });
    const { ctx } = makeCtx({ gsc: { query } });
    const res = expectSuccess(
      await gscDecay(ctx, {
        siteUrl: 'https://a.com/',
        windowDays: 28,
        minImpressions: 100,
        minDeclinePct: 0.2,
        limit: 25,
      }),
    );
    expect(res.structuredContent).toMatchObject({
      decaying: [{ key: '/old', declinePct: 0.8, lostRank: true }],
    });
    expect(res.content[0]?.text).toContain('seasonality');
  });
});

describe('gscUrlInspect', () => {
  it('returns one compact row per URL in input order, with a per-URL error row on failure', async () => {
    const inspectUrl = vi.fn<GscLike['inspectUrl']>(async (_site, url) => {
      if (url.endsWith('/bad')) throw new Error('403 not owner');
      return { ...emptyInspection, googleCanonical: url };
    });
    const { ctx } = makeCtx({ gsc: { inspectUrl } });
    const urls = ['https://x.com/a', 'https://x.com/bad', 'https://x.com/c', 'https://x.com/d'];

    const res = expectSuccess(await gscUrlInspect(ctx, { siteUrl: 'sc-domain:x.com', urls }));

    expect(inspectUrl).toHaveBeenCalledTimes(4);
    expect(inspectUrl).toHaveBeenCalledWith('sc-domain:x.com', 'https://x.com/a');
    const rows = (res.structuredContent as { rows: Record<string, unknown>[] }).rows;
    expect(rows.map((r) => r['url'])).toEqual(urls);
    expect(rows[1]).toEqual({ url: 'https://x.com/bad', error: '403 not owner' });
    expect(rows[0]).toMatchObject({ verdict: 'PASS', googleCanonical: 'https://x.com/a' });
    expect(rows[0]).not.toHaveProperty('error');
    expect(res.content[0]?.text).toContain('Inspected 3 of 4 URLs');
  });
});
