/**
 * GA4 Data API client (analyticsdata.googleapis.com v1beta).
 *
 * Thin wrapper over the `runReport` endpoint that maps Google's positional row/header shape into
 * the named {@link Ga4Row} contract. All HTTP flows through an injectable {@link Fetcher}.
 */
import type { Ga4Property, Ga4Report, Ga4ReportRequest, Ga4Row } from '@aeo/types';
import {
  asNumber,
  asRecord,
  asRecordArray,
  asString,
  defaultFetcher,
  requestJson,
  type Fetcher,
} from './http.js';

const GA4_DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const GA4_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';

/**
 * Upper bound on `accountSummaries` pages fetched in a single {@link Ga4Client.listProperties}
 * call. A guard against a server that never stops returning a `nextPageToken`; far above the
 * number of accounts any real token can access.
 */
const MAX_ACCOUNT_SUMMARY_PAGES = 50;

/** GA4 Admin caps `accountSummaries` page size at 200; request the max to minimize round-trips. */
const ACCOUNT_SUMMARY_PAGE_SIZE = 200;

export interface Ga4ClientOptions {
  /** OAuth 2.0 access token with the `analytics.readonly` scope. */
  accessToken: string;
  /** Injectable fetch; defaults to the platform global `fetch`. */
  fetcher?: Fetcher;
}

export class Ga4Client {
  private readonly accessToken: string;
  private readonly fetcher: Fetcher;

  constructor(opts: Ga4ClientOptions) {
    this.accessToken = opts.accessToken;
    this.fetcher = opts.fetcher ?? defaultFetcher();
  }

  /**
   * Run a GA4 report. LIVE HTTP: POSTs to
   * `analyticsdata.googleapis.com/v1beta/properties/{id}:runReport`.
   *
   * Maps the API's parallel `dimensionHeaders`/`metricHeaders` + positional `dimensionValues`/
   * `metricValues` into named {@link Ga4Row} records keyed by header name.
   */
  async runReport(req: Ga4ReportRequest): Promise<Ga4Report> {
    const propertyId = normalizePropertyId(req.propertyId);
    const url = `${GA4_DATA_BASE}/properties/${propertyId}:runReport`;

    const body = {
      dateRanges: req.dateRanges.map((r) => ({ startDate: r.startDate, endDate: r.endDate })),
      dimensions: req.dimensions.map((name) => ({ name })),
      metrics: req.metrics.map((name) => ({ name })),
      ...(req.limit !== undefined ? { limit: String(req.limit) } : {}),
    };

    const json = await requestJson(this.fetcher, url, {
      method: 'POST',
      accessToken: this.accessToken,
      body,
    });

    return mapRunReport(json);
  }

  /**
   * List the GA4 properties the token can access. LIVE HTTP: GETs
   * `analyticsadmin.googleapis.com/v1beta/accountSummaries` (covered by the `analytics.readonly`
   * scope) and flattens every account's `propertySummaries[]` into {@link Ga4Property} records.
   *
   * Follows `nextPageToken` pagination up to {@link MAX_ACCOUNT_SUMMARY_PAGES} pages so a
   * misbehaving server cannot loop forever. The `propertyId` is the bare numeric id with the
   * `properties/` resource prefix stripped, matching {@link Ga4ReportRequest.propertyId}.
   */
  async listProperties(): Promise<Ga4Property[]> {
    const properties: Ga4Property[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_ACCOUNT_SUMMARY_PAGES; page += 1) {
      const params = new URLSearchParams({ pageSize: String(ACCOUNT_SUMMARY_PAGE_SIZE) });
      if (pageToken !== undefined && pageToken.length > 0) {
        params.set('pageToken', pageToken);
      }
      const url = `${GA4_ADMIN_BASE}/accountSummaries?${params.toString()}`;

      const json = await requestJson(this.fetcher, url, {
        method: 'GET',
        accessToken: this.accessToken,
      });

      const root = asRecord(json);
      for (const summary of asRecordArray(root['accountSummaries'])) {
        for (const property of asRecordArray(summary['propertySummaries'])) {
          const resourceName = asString(property['property']);
          if (resourceName.length === 0) continue;
          properties.push({
            propertyId: normalizePropertyId(resourceName),
            displayName: asString(property['displayName']),
          });
        }
      }

      const next = asString(root['nextPageToken']);
      if (next.length === 0) break;
      pageToken = next;
    }

    return properties;
  }
}

/** Accept either a bare numeric id (`123456`) or a `properties/123456` resource name. */
function normalizePropertyId(propertyId: string): string {
  const trimmed = propertyId.trim();
  return trimmed.startsWith('properties/') ? trimmed.slice('properties/'.length) : trimmed;
}

/** Map a raw `runReport` JSON response into the named {@link Ga4Report} contract. */
function mapRunReport(json: unknown): Ga4Report {
  const root = asRecord(json);

  const dimensionHeaders = asRecordArray(root['dimensionHeaders'])
    .map((h) => asString(h['name']))
    .filter((name) => name.length > 0);
  const metricHeaders = asRecordArray(root['metricHeaders'])
    .map((h) => asString(h['name']))
    .filter((name) => name.length > 0);

  const rawRows = asRecordArray(root['rows']);
  const rows: Ga4Row[] = rawRows.map((row) => {
    const dimensionValues = asRecordArray(row['dimensionValues']);
    const metricValues = asRecordArray(row['metricValues']);

    const dimensions: Record<string, string> = {};
    dimensionHeaders.forEach((name, i) => {
      const cell = dimensionValues[i];
      dimensions[name] = cell ? asString(cell['value']) : '';
    });

    const metrics: Record<string, number> = {};
    metricHeaders.forEach((name, i) => {
      const cell = metricValues[i];
      metrics[name] = cell ? asNumber(cell['value']) : 0;
    });

    return { dimensions, metrics };
  });

  const rowCount = root['rowCount'] !== undefined ? asNumber(root['rowCount']) : rows.length;
  return { rows, rowCount };
}
