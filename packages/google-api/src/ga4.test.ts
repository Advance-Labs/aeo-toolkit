import { describe, expect, it } from 'vitest';
import type { Ga4ReportRequest } from '@advance-labs/types';
import { Ga4Client } from './ga4.js';
import { GoogleApiError, type Fetcher } from './http.js';
import { errorFetcher, jsonFetcher, parseBody, type RecordedCall } from './test-helpers.js';

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

/**
 * Build a fetcher that returns each queued body in turn (one per call), recording every request.
 * Used to exercise `nextPageToken` pagination, which a single fixed-body fetcher cannot model.
 */
function sequencedFetcher(bodies: readonly unknown[]): { fetcher: Fetcher; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let i = 0;
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    const body = i < bodies.length ? bodies[i] : {};
    i += 1;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
  return { fetcher, calls };
}

describe('Ga4Client.listProperties', () => {
  it('GETs accountSummaries and flattens multiple accounts into Ga4Property records', async () => {
    const mock = jsonFetcher({
      accountSummaries: [
        {
          account: 'accounts/1',
          displayName: 'Acme',
          propertySummaries: [
            { property: 'properties/111', displayName: 'Acme Web' },
            { property: 'properties/222', displayName: 'Acme App' },
          ],
        },
        {
          account: 'accounts/2',
          displayName: 'Globex',
          propertySummaries: [{ property: 'properties/333', displayName: 'Globex' }],
        },
      ],
    });
    const client = new Ga4Client({ accessToken: 'tok-a', fetcher: mock.fetcher });

    const props = await client.listProperties();

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    expect(call.url).toBe(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
    );
    expect(call.init?.method).toBe('GET');
    expect(call.init?.headers?.['Authorization']).toBe('Bearer tok-a');

    // propertyId has the `properties/` prefix stripped; order is account-then-property.
    expect(props).toEqual([
      { propertyId: '111', displayName: 'Acme Web' },
      { propertyId: '222', displayName: 'Acme App' },
      { propertyId: '333', displayName: 'Globex' },
    ]);
  });

  it('follows nextPageToken pagination and concatenates every page', async () => {
    const mock = sequencedFetcher([
      {
        accountSummaries: [
          { propertySummaries: [{ property: 'properties/1', displayName: 'P1' }] },
        ],
        nextPageToken: 'page-2',
      },
      {
        accountSummaries: [
          { propertySummaries: [{ property: 'properties/2', displayName: 'P2' }] },
        ],
        // no nextPageToken → loop terminates
      },
    ]);
    const client = new Ga4Client({ accessToken: 'tok', fetcher: mock.fetcher });

    const props = await client.listProperties();

    expect(mock.calls).toHaveLength(2);
    // First page has no token; second page forwards the returned token.
    expect(mock.calls[0]?.url).toBe(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
    );
    expect(mock.calls[1]?.url).toBe(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200&pageToken=page-2',
    );
    expect(props).toEqual([
      { propertyId: '1', displayName: 'P1' },
      { propertyId: '2', displayName: 'P2' },
    ]);
  });

  it('returns an empty array when the token can access no accounts', async () => {
    const mock = jsonFetcher({});
    const client = new Ga4Client({ accessToken: 'tok', fetcher: mock.fetcher });
    await expect(client.listProperties()).resolves.toEqual([]);
    expect(mock.calls).toHaveLength(1);
  });

  it('throws GoogleApiError on a non-2xx response', async () => {
    const mock = errorFetcher(403, 'permission denied');
    const client = new Ga4Client({ accessToken: 'bad', fetcher: mock.fetcher });
    await expect(client.listProperties()).rejects.toBeInstanceOf(GoogleApiError);
  });
});
