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
   * STUB: list GA4 properties accessible to the token.
   *
   * The Admin API (analyticsadmin.googleapis.com v1beta accountSummaries) requires the
   * `analytics.readonly` admin surface and account-summary pagination, which is out of scope for
   * the 0.1.0 read-report path. The seam is typed so the wiring point is obvious: implement by
   * GETting `/v1beta/accountSummaries`, flatten `propertySummaries`, and map to {@link Ga4Property}.
   */
  // STUB: live Admin API call not wired — returns empty until implemented.
  async listProperties(): Promise<Ga4Property[]> {
    return [];
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
