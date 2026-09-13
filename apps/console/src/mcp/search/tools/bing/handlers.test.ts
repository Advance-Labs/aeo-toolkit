import { describe, expect, it, vi } from 'vitest';
import { BingKeyResolver, InMemoryBingKeyStore } from '../../auth/bing.js';
import type { BingLike, ToolContext } from '../context.js';
import {
  bingIndexHealth,
  bingKeywordResearch,
  bingQueryPages,
  bingTopPages,
  bingTopQueries,
  bingTrafficStats,
  listBingSites,
} from './handlers.js';

function ctxWithBing(bing: Partial<BingLike>): ToolContext {
  return {
    tokens: { resolveAccessToken: async () => 't' } as ToolContext['tokens'],
    bingKeys: new BingKeyResolver({ store: new InMemoryBingKeyStore(), staticApiKey: 'k' }),
    clients: { ga4: vi.fn(), gsc: vi.fn(), bing: () => bing as BingLike } as never,
    userId: 'u1',
    requestToken: null,
    requestBingKey: null,
  };
}

function payload(result: { content: { text: string }[]; structuredContent: Record<string, unknown> }): Record<string, unknown> {
  return result.structuredContent;
}

describe('listBingSites', () => {
  it('returns the sites the key can see', async () => {
    const ctx = ctxWithBing({
      listSites: async () => [{ url: 'https://example.com/', isVerified: true }],
    });
    const out = payload(await listBingSites(ctx) as never);
    expect(out['sites']).toEqual([{ url: 'https://example.com/', isVerified: true }]);
  });

  it('surfaces the missing-credential error rather than an empty list', async () => {
    const ctx = ctxWithBing({});
    ctx.bingKeys = new BingKeyResolver({
      store: new InMemoryBingKeyStore(),
      staticApiKey: null,
    });
    await expect(listBingSites(ctx)).rejects.toThrow(/BING_API_KEY/);
  });
});

describe('bingTrafficStats', () => {
  it('totals clicks and impressions across the series', async () => {
    const ctx = ctxWithBing({
      getRankAndTrafficStats: async () => [
        { date: '2014-05-03T07:00:00.000Z', clicks: 10, impressions: 100 },
        { date: '2014-05-04T07:00:00.000Z', clicks: 5, impressions: 50 },
      ],
    });
    const out = payload(
      (await bingTrafficStats(ctx, { siteUrl: 'https://example.com/', limit: 50 })) as never,
    );
    expect(out['totals']).toEqual({ clicks: 15, impressions: 150 });
  });
});

describe('bingTopQueries', () => {
  it('sorts by clicks descending and honours the limit', async () => {
    const ctx = ctxWithBing({
      getQueryStats: async () => [
        { query: 'low', clicks: 1, impressions: 10, avgClickPosition: 9, avgImpressionPosition: 12, date: null },
        { query: 'high', clicks: 50, impressions: 900, avgClickPosition: 2, avgImpressionPosition: 4, date: null },
        { query: 'mid', clicks: 20, impressions: 400, avgClickPosition: 5, avgImpressionPosition: 7, date: null },
      ],
    });
    const out = payload(
      (await bingTopQueries(ctx, { siteUrl: 'https://example.com/', limit: 2 })) as never,
    );
    const rows = out['queries'] as { query: string }[];
    expect(rows.map((r) => r.query)).toEqual(['high', 'mid']);
  });

  it('keeps both position fields so the cross layer can choose', async () => {
    const ctx = ctxWithBing({
      getQueryStats: async () => [
        { query: 'q', clicks: 1, impressions: 10, avgClickPosition: 2.5, avgImpressionPosition: 8.1, date: null },
      ],
    });
    const out = payload(
      (await bingTopQueries(ctx, { siteUrl: 'https://example.com/', limit: 50 })) as never,
    );
    const rows = out['queries'] as Record<string, unknown>[];
    expect(rows[0]!['avgClickPosition']).toBe(2.5);
    expect(rows[0]!['avgImpressionPosition']).toBe(8.1);
  });
});

describe('bingTopPages', () => {
  it('sorts by clicks descending and honours the limit', async () => {
    const ctx = ctxWithBing({
      getPageStats: async () => [
        { page: 'https://example.com/low', clicks: 1, impressions: 10, avgClickPosition: 9, avgImpressionPosition: 12 },
        {
          page: 'https://example.com/high',
          clicks: 50,
          impressions: 900,
          avgClickPosition: 2,
          avgImpressionPosition: 4,
        },
        { page: 'https://example.com/mid', clicks: 20, impressions: 400, avgClickPosition: 5, avgImpressionPosition: 7 },
      ],
    });
    const out = payload(
      (await bingTopPages(ctx, { siteUrl: 'https://example.com/', limit: 2 })) as never,
    );
    const rows = out['pages'] as { page: string }[];
    expect(rows.map((r) => r.page)).toEqual(['https://example.com/high', 'https://example.com/mid']);
  });
});

describe('bingQueryPages', () => {
  it('returns pages when given a query', async () => {
    const ctx = ctxWithBing({
      getQueryPageStats: async () => [
        { page: 'https://example.com/a', clicks: 4, impressions: 40, avgClickPosition: 3, avgImpressionPosition: 6 },
      ],
    });
    const out = payload(
      (await bingQueryPages(ctx, { siteUrl: 'https://example.com/', query: 'aeo' })) as never,
    );
    expect(out['direction']).toBe('query_to_pages');
    expect((out['pages'] as unknown[]).length).toBe(1);
  });

  it('returns queries when given a page', async () => {
    const ctx = ctxWithBing({
      getPageQueryStats: async () => [
        { query: 'aeo', clicks: 4, impressions: 40, avgClickPosition: 3, avgImpressionPosition: 6, date: null },
      ],
    });
    const out = payload(
      (await bingQueryPages(ctx, {
        siteUrl: 'https://example.com/',
        page: 'https://example.com/a',
      })) as never,
    );
    expect(out['direction']).toBe('page_to_queries');
  });

  it('rejects neither query nor page', async () => {
    const ctx = ctxWithBing({});
    await expect(bingQueryPages(ctx, { siteUrl: 'https://example.com/' })).rejects.toThrow(
      /exactly one/i,
    );
  });

  it('rejects both query and page', async () => {
    const ctx = ctxWithBing({});
    await expect(
      bingQueryPages(ctx, { siteUrl: 'https://example.com/', query: 'a', page: 'b' }),
    ).rejects.toThrow(/exactly one/i);
  });
});

describe('bingIndexHealth', () => {
  it('reports crawl stats, issues and quota without inspecting a url', async () => {
    const ctx = ctxWithBing({
      getCrawlStats: async () => [
        {
          date: '2014-05-03T07:00:00.000Z',
          crawledPages: 100,
          inIndex: 80,
          inLinks: 5,
          blockedByRobotsTxt: 2,
          codes4xx: 3,
          codes5xx: 1,
        },
      ],
      getCrawlIssues: async () => [{ url: 'https://example.com/bad', issues: 2 }],
      getUrlSubmissionQuota: async () => ({ dailyQuota: 10, monthlyQuota: 100 }),
    });
    const out = payload(
      (await bingIndexHealth(ctx, { siteUrl: 'https://example.com/' })) as never,
    );
    expect(out['quota']).toEqual({ dailyQuota: 10, monthlyQuota: 100 });
    expect(out['urlInfo']).toBeNull();
  });

  it('adds urlInfo only when a url is supplied', async () => {
    const ctx = ctxWithBing({
      getCrawlStats: async () => [],
      getCrawlIssues: async () => [],
      getUrlSubmissionQuota: async () => ({ dailyQuota: 10, monthlyQuota: 100 }),
      getUrlInfo: async () => ({
        url: 'https://example.com/a',
        discoveredDate: null,
        documentSize: 1200,
        httpStatus: 200,
        isPageIndexed: true,
        lastCrawledDate: null,
      }),
    });
    const out = payload(
      (await bingIndexHealth(ctx, {
        siteUrl: 'https://example.com/',
        url: 'https://example.com/a',
      })) as never,
    );
    expect((out['urlInfo'] as Record<string, unknown>)['isPageIndexed']).toBe(true);
  });
});

describe('bingKeywordResearch', () => {
  it('merges seed stats and related keywords, deduplicating by query', async () => {
    const ctx = ctxWithBing({
      getKeywordStats: async () => [{ query: 'aeo', impressions: 100, broadImpressions: 500 }],
      getRelatedKeywords: async () => [
        { query: 'aeo', impressions: 100, broadImpressions: 500 },
        { query: 'geo tools', impressions: 60, broadImpressions: 300 },
      ],
    });
    const out = payload((await bingKeywordResearch(ctx, { query: 'aeo' })) as never);
    const kws = out['keywords'] as { query: string }[];
    expect(kws.map((k) => k.query)).toEqual(['aeo', 'geo tools']);
  });
});
