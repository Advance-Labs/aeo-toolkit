import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BingWebmasterClient } from './webmaster.js';
import type { FetchInit, FetchResponse } from './http.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
}

function respond(body: unknown): FetchResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function clientFor(body: unknown) {
  const fetcher = vi.fn(async (_url: string, _init?: FetchInit) => respond(body));
  return { client: new BingWebmasterClient({ apiKey: 'k', fetcher }), fetcher };
}

describe('BingWebmasterClient', () => {
  it('listSites maps Url/IsVerified and drops the verification secrets', async () => {
    const { client } = clientFor(fixture('get-user-sites'));
    const sites = await client.listSites();
    expect(sites).toEqual([
      { url: 'https://example.com/', isVerified: true },
      { url: 'https://docs.example.com/', isVerified: true },
    ]);
    // The live payload carries AuthenticationCode and DnsVerificationCode. They are
    // site-verification credentials and must not survive into our shape.
    for (const site of sites) {
      expect(Object.keys(site).sort()).toEqual(['isVerified', 'url']);
    }
  });

  it('getRankAndTrafficStats converts WCF dates to ISO 8601', async () => {
    const { client } = clientFor(fixture('get-rank-and-traffic-stats'));
    const rows = await client.getRankAndTrafficStats('https://example.com/');
    // Live Bing sends `/Date(1780531200000)/` with NO timezone offset, unlike the
    // offset-bearing form the docs show. Verified 2026-09-09.
    expect(rows[0]).toEqual({
      date: '2026-06-04T00:00:00.000Z',
      clicks: 0,
      impressions: 0,
    });
  });

  it('getQueryStats keeps BOTH position fields distinct', async () => {
    const { client } = clientFor(fixture('get-query-stats'));
    const rows = await client.getQueryStats('https://example.com/');
    const clicked = rows.find((row) => row.clicks > 0);
    expect(clicked?.avgClickPosition).toBe(2.5);
    expect(clicked?.avgImpressionPosition).toBe(4);
  });

  it("normalizes Bing's -1 position sentinel to null, never to a number", async () => {
    const { client } = clientFor(fixture('get-query-stats'));
    const rows = await client.getQueryStats('https://example.com/');
    const zeroClick = rows.filter((row) => row.clicks === 0);
    expect(zeroClick.length).toBeGreaterThan(0);
    for (const row of zeroClick) {
      // -1 is what Bing actually sends here. It is not a position and must never
      // reach a caller as one.
      expect(row.avgClickPosition).toBeNull();
    }
    // A real impression position on the same rows survives untouched.
    expect(zeroClick[0]?.avgImpressionPosition).toBe(6);
  });

  it('returns per-(query x date) rows, so a query can repeat across dates', async () => {
    const { client } = clientFor(fixture('get-query-stats'));
    const rows = await client.getQueryStats('https://example.com/');
    const brand = rows.filter((row) => row.query === 'example brand');
    // Verified live 2026-09-09: maxRowsForOneQuery=3 across distinctDates=6. This
    // is what makes client-side date bucketing possible despite GetQueryStats
    // accepting no date parameter.
    expect(brand.length).toBe(3);
    expect(new Set(brand.map((row) => row.date)).size).toBe(3);
    for (const row of brand) expect(row.date).not.toBeNull();
  });

  it('getPageStats reads the page URL from Query, the field Bing actually sends', async () => {
    const { client } = clientFor(fixture('get-page-stats'));
    const rows = await client.getPageStats('https://example.com/');
    // Bing reuses the QueryStats wire type for page stats and emits no `Url`
    // field at all. Verified live 2026-09-09 on GetPageStats and GetQueryPageStats.
    expect(rows[0]?.page).toBe('https://example.com/');
    expect(rows[1]?.page).toBe('https://example.com/guides/how-to');
    expect(rows[0]?.avgClickPosition).toBeNull();
    expect(rows[1]?.avgClickPosition).toBe(3);
  });

  it('sends the siteUrl parameter', async () => {
    const { client, fetcher } = clientFor(fixture('get-query-stats'));
    await client.getQueryStats('https://example.com/');
    expect(fetcher.mock.calls[0]![0]).toContain('siteUrl=https%3A%2F%2Fexample.com%2F');
  });

  it('throws rather than nulling when a date is malformed', async () => {
    const { client } = clientFor({ d: [{ Date: '2014-05-03', Clicks: 1, Impressions: 2 }] });
    await expect(client.getRankAndTrafficStats('https://example.com/')).rejects.toThrow(
      /WCF date/i,
    );
  });

  it('getUrlSubmissionQuota unwraps an object payload', async () => {
    const { client } = clientFor({ d: { DailyQuota: 10, MonthlyQuota: 100 } });
    await expect(client.getUrlSubmissionQuota('https://example.com/')).resolves.toEqual({
      dailyQuota: 10,
      monthlyQuota: 100,
    });
  });

  it('lowercases the country Bing rejects in uppercase', async () => {
    // Live 2026-09-09: country=CA returns 400 "argument out of range", country=ca is fine.
    const { client, fetcher } = clientFor({ d: [] });
    await client.getKeywordStats('llms.txt', 'CA');
    expect(fetcher.mock.calls[0]![0]).toContain('country=ca');
  });

  it('normalizes a language tag to Bing\'s xx-XX casing', async () => {
    // en-ca and en both 400; only en-CA is accepted.
    const { client, fetcher } = clientFor({ d: [] });
    await client.getKeywordStats('llms.txt', 'ca', 'en-ca');
    expect(fetcher.mock.calls[0]![0]).toContain('language=en-CA');
  });

  it('takes the region from country when the language tag has none', async () => {
    const { client, fetcher } = clientFor({ d: [] });
    await client.getKeywordStats('llms.txt', 'CA', 'en');
    const url = fetcher.mock.calls[0]![0];
    expect(url).toContain('country=ca');
    expect(url).toContain('language=en-CA');
  });

  it('refuses a bare language with no country rather than guessing a market', async () => {
    // Dropping it would silently widen the query; guessing returns real-looking
    // numbers for the wrong market. Both are worse than refusing.
    const { client } = clientFor({ d: [] });
    await expect(client.getKeywordStats('llms.txt', undefined, 'en')).rejects.toThrow(
      /region-qualified language tag/i,
    );
  });

  it('applies the same normalization to getRelatedKeywords', async () => {
    const { client, fetcher } = clientFor({ d: [] });
    await client.getRelatedKeywords('llms.txt', 'US', 'en');
    const url = fetcher.mock.calls[0]![0];
    expect(url).toContain('country=us');
    expect(url).toContain('language=en-US');
  });

  it('getKeywordStats omits absent optional params', async () => {
    const { client, fetcher } = clientFor({ d: [] });
    await client.getKeywordStats('aeo tools');
    const url = fetcher.mock.calls[0]![0];
    expect(url).toContain('q=aeo+tools');
    expect(url).not.toContain('country');
    expect(url).not.toContain('language');
  });

  it('exposes no method whose name implies a write', () => {
    const names = Object.getOwnPropertyNames(BingWebmasterClient.prototype);
    for (const name of names) {
      expect(name).not.toMatch(/^(submit|add|remove|save|update|verify|fetch|enable)/i);
    }
  });
});
