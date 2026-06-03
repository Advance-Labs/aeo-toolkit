import { describe, expect, it } from 'vitest';
import type { Ga4ReportRequest } from '@aeo/types';
import { Ga4Client } from './ga4.js';
import { GoogleApiError } from './http.js';
import { errorFetcher, jsonFetcher, parseBody } from './test-helpers.js';

const sampleRequest: Ga4ReportRequest = {
  propertyId: '123456',
  dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
  dimensions: ['date', 'pagePath'],
  metrics: ['screenPageViews', 'totalUsers'],
  limit: 10,
};

const sampleResponse = {
  dimensionHeaders: [{ name: 'date' }, { name: 'pagePath' }],
  metricHeaders: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
  rows: [
    {
      dimensionValues: [{ value: '20240101' }, { value: '/home' }],
      metricValues: [{ value: '42' }, { value: '17' }],
    },
  ],
  rowCount: 1,
};

describe('Ga4Client.runReport', () => {
  it('posts the correct request shape and maps rows to named Ga4Row records', async () => {
    const mock = jsonFetcher(sampleResponse);
    const client = new Ga4Client({ accessToken: 'tok-123', fetcher: mock.fetcher });

    const report = await client.runReport(sampleRequest);

    // Request shape assertions.
    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    expect(call.url).toBe(
      'https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport',
    );
    expect(call.init?.method).toBe('POST');
    expect(call.init?.headers?.['Authorization']).toBe('Bearer tok-123');
    expect(call.init?.headers?.['Content-Type']).toBe('application/json');

    const body = parseBody(call);
    expect(body['dateRanges']).toEqual([{ startDate: '2024-01-01', endDate: '2024-01-31' }]);
    expect(body['dimensions']).toEqual([{ name: 'date' }, { name: 'pagePath' }]);
    expect(body['metrics']).toEqual([{ name: 'screenPageViews' }, { name: 'totalUsers' }]);
    expect(body['limit']).toBe('10'); // GA4 expects limit as a string

    // Response mapping assertions.
    expect(report.rowCount).toBe(1);
    expect(report.rows).toHaveLength(1);
    const row = report.rows[0];
    expect(row).toBeDefined();
    if (!row) throw new Error('expected a row');
    expect(row.dimensions).toEqual({ date: '20240101', pagePath: '/home' });
    expect(row.metrics).toEqual({ screenPageViews: 42, totalUsers: 17 });
  });

  it('normalizes a `properties/{id}` resource name in the propertyId', async () => {
    const mock = jsonFetcher(sampleResponse);
    const client = new Ga4Client({ accessToken: 'tok', fetcher: mock.fetcher });

    await client.runReport({ ...sampleRequest, propertyId: 'properties/999' });

    const call = mock.calls[0];
    expect(call?.url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/999:runReport');
  });

  it('handles an empty report (no rows, no rowCount) without throwing', async () => {
    const mock = jsonFetcher({ dimensionHeaders: [], metricHeaders: [] });
    const client = new Ga4Client({ accessToken: 'tok', fetcher: mock.fetcher });

    const report = await client.runReport(sampleRequest);
    expect(report.rows).toEqual([]);
    expect(report.rowCount).toBe(0);
  });

  it('throws GoogleApiError on a non-2xx response', async () => {
    const mock = errorFetcher(403, 'permission denied');
    const client = new Ga4Client({ accessToken: 'bad', fetcher: mock.fetcher });

    await expect(client.runReport(sampleRequest)).rejects.toBeInstanceOf(GoogleApiError);
    await expect(client.runReport(sampleRequest)).rejects.toMatchObject({ status: 403 });
  });
});

describe('Ga4Client.listProperties (stub)', () => {
  it('returns an empty array until the Admin API is wired', async () => {
    const mock = jsonFetcher({});
    const client = new Ga4Client({ accessToken: 'tok', fetcher: mock.fetcher });
    await expect(client.listProperties()).resolves.toEqual([]);
  });
});
