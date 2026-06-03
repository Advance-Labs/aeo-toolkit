import { describe, expect, it } from 'vitest';
import type { GscQueryRequest } from '@aeo/types';
import { GscClient } from './gsc.js';
import { GoogleApiError } from './http.js';
import { errorFetcher, jsonFetcher, parseBody } from './test-helpers.js';

const sampleQuery: GscQueryRequest = {
  siteUrl: 'https://example.com/',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  dimensions: ['query', 'page'],
  rowLimit: 25,
};

const sampleQueryResponse = {
  rows: [
    { keys: ['ai seo', '/blog'], clicks: 5, impressions: 100, ctr: 0.05, position: 3.2 },
    { keys: ['aeo', '/'], clicks: 2, impressions: 40, ctr: 0.05, position: 7.1 },
  ],
};

describe('GscClient.query', () => {
  it('posts to the encoded site URL and maps rows to GscRow', async () => {
    const mock = jsonFetcher(sampleQueryResponse);
    const client = new GscClient({ accessToken: 'tok-9', fetcher: mock.fetcher });

    const report = await client.query(sampleQuery);

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    expect(call.url).toBe(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexample.com%2F/searchAnalytics/query',
    );
    expect(call.init?.method).toBe('POST');
    expect(call.init?.headers?.['Authorization']).toBe('Bearer tok-9');

    const body = parseBody(call);
    expect(body['startDate']).toBe('2024-01-01');
    expect(body['endDate']).toBe('2024-01-31');
    expect(body['dimensions']).toEqual(['query', 'page']);
    expect(body['rowLimit']).toBe(25);

    expect(report.rows).toHaveLength(2);
    const first = report.rows[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('expected a row');
    expect(first.keys).toEqual(['ai seo', '/blog']);
    expect(first.clicks).toBe(5);
    expect(first.position).toBeCloseTo(3.2);
  });

  it('omits optional fields and handles an empty result set', async () => {
    const mock = jsonFetcher({});
    const client = new GscClient({ accessToken: 'tok', fetcher: mock.fetcher });

    const report = await client.query({
      siteUrl: 'sc-domain:example.com',
      startDate: '2024-02-01',
      endDate: '2024-02-02',
    });

    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    const body = parseBody(call);
    expect(body['dimensions']).toBeUndefined();
    expect(body['rowLimit']).toBeUndefined();
    expect(report.rows).toEqual([]);
  });

  it('throws GoogleApiError on a non-2xx response', async () => {
    const mock = errorFetcher(401, 'unauthorized');
    const client = new GscClient({ accessToken: 'bad', fetcher: mock.fetcher });
    await expect(client.query(sampleQuery)).rejects.toBeInstanceOf(GoogleApiError);
  });
});

describe('GscClient.listSites', () => {
  it('GETs the sites endpoint and maps entries to GscSite', async () => {
    const mock = jsonFetcher({
      siteEntry: [
        { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteFullUser' },
      ],
    });
    const client = new GscClient({ accessToken: 'tok', fetcher: mock.fetcher });

    const sites = await client.listSites();

    const call = mock.calls[0];
    expect(call?.url).toBe('https://searchconsole.googleapis.com/webmasters/v3/sites');
    expect(call?.init?.method).toBe('GET');
    expect(sites).toEqual([
      { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
      { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteFullUser' },
    ]);
  });

  it('returns an empty array when no sites are present', async () => {
    const mock = jsonFetcher({});
    const client = new GscClient({ accessToken: 'tok', fetcher: mock.fetcher });
    await expect(client.listSites()).resolves.toEqual([]);
  });
});

describe('GscClient.submitSitemap', () => {
  it('PUTs the encoded feedpath under the encoded siteUrl and resolves on success', async () => {
    const mock = jsonFetcher({});
    const client = new GscClient({ accessToken: 'tok-w', fetcher: mock.fetcher });

    await expect(
      client.submitSitemap('https://example.com/', 'https://example.com/sitemap.xml'),
    ).resolves.toBeUndefined();

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    expect(call.url).toBe(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/' +
        'https%3A%2F%2Fexample.com%2F/sitemaps/https%3A%2F%2Fexample.com%2Fsitemap.xml',
    );
    expect(call.init?.method).toBe('PUT');
    expect(call.init?.headers?.['Authorization']).toBe('Bearer tok-w');
    // Empty body — sitemap submission carries no payload.
    expect(call.init?.body).toBeUndefined();
  });

  it('throws GoogleApiError on a non-2xx response (e.g. missing write scope)', async () => {
    const mock = errorFetcher(403, 'insufficient permission');
    const client = new GscClient({ accessToken: 'readonly-tok', fetcher: mock.fetcher });
    await expect(
      client.submitSitemap('sc-domain:example.com', '/sitemap.xml'),
    ).rejects.toBeInstanceOf(GoogleApiError);
  });
});
