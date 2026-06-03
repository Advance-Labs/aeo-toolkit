import { describe, expect, it, vi } from 'vitest';
import type { ToolResult, ToolSuccessResult } from '@aeo/mcp-core';
import type { Ga4Report, GscReport, GscSite, Ga4Property } from '@aeo/types';

import type { ClientFactory, Ga4Like, GscLike, ToolContext } from './context.js';
import {
  comparePeriodsTool,
  ga4RunReport,
  gscCtrGaps,
  gscSearchAnalytics,
  gscTopQueries,
  listGa4Properties,
  listGscSites,
} from './handlers.js';

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
  };
  const ga4Factory = vi.fn((_token: string) => ga4);
  const gscFactory = vi.fn((_token: string) => gsc);
  const clients: ClientFactory = { ga4: ga4Factory, gsc: gscFactory };
  const { resolver } = fakeResolver(opts.token);
  const ctx: ToolContext = {
    tokens: resolver,
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
      clients: {
        ga4: () => ga4,
        gsc: () => ({ query: vi.fn(), listSites: vi.fn() }) as unknown as GscLike,
      },
      userId: 'u1',
      requestToken: 'byok-abc',
    };
    await listGa4Properties(ctx);
    expect(resolveAccessToken).toHaveBeenCalledWith('u1', 'byok-abc');
  });
});
