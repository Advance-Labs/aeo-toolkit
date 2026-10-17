/**
 * Google Search Console client (searchconsole.googleapis.com webmasters v3).
 *
 * Wraps `searchAnalytics.query`, `sites.list`, sitemap submit and URL Inspection. All HTTP flows through an injectable
 * {@link Fetcher} so the logic is unit-testable without a live network.
 */
import type {
  GscQueryRequest,
  GscReport,
  GscRow,
  GscSite,
  GscUrlInspection,
} from '@advance-labs/types';
import {
  asNumber,
  asRecord,
  asRecordArray,
  asString,
  defaultFetcher,
  requestJson,
  type Fetcher,
} from './http.js';

const GSC_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';
/** URL Inspection lives on the v1 base, not webmasters/v3. */
const GSC_INSPECT_URL = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

export interface GscClientOptions {
  /** OAuth 2.0 access token with the `webmasters.readonly` scope. */
  accessToken: string;
  /** Injectable fetch; defaults to the platform global `fetch`. */
  fetcher?: Fetcher;
}

export class GscClient {
  private readonly accessToken: string;
  private readonly fetcher: Fetcher;

  constructor(opts: GscClientOptions) {
    this.accessToken = opts.accessToken;
    this.fetcher = opts.fetcher ?? defaultFetcher();
  }

  /**
   * Query Search Analytics. LIVE HTTP: POSTs to
   * `webmasters/v3/sites/{encoded siteUrl}/searchAnalytics/query`.
   *
   * Maps each API row's `keys`/`clicks`/`impressions`/`ctr`/`position` into {@link GscRow}.
   */
  async query(req: GscQueryRequest): Promise<GscReport> {
    const url = `${GSC_BASE}/sites/${encodeURIComponent(req.siteUrl)}/searchAnalytics/query`;

    const body = {
      startDate: req.startDate,
      endDate: req.endDate,
      ...(req.dimensions !== undefined ? { dimensions: req.dimensions } : {}),
      ...(req.rowLimit !== undefined ? { rowLimit: req.rowLimit } : {}),
    };

    const json = await requestJson(this.fetcher, url, {
      method: 'POST',
      accessToken: this.accessToken,
      body,
    });

    return mapQuery(json);
  }

  /**
   * List sites the token can access. LIVE HTTP: GETs `webmasters/v3/sites`.
   * Maps each entry's `siteUrl`/`permissionLevel` into {@link GscSite}.
   */
  async listSites(): Promise<GscSite[]> {
    const url = `${GSC_BASE}/sites`;
    const json = await requestJson(this.fetcher, url, {
      method: 'GET',
      accessToken: this.accessToken,
    });

    const root = asRecord(json);
    return asRecordArray(root['siteEntry']).map((entry) => ({
      siteUrl: asString(entry['siteUrl']),
      permissionLevel: asString(entry['permissionLevel']),
    }));
  }

  /**
   * Submit (or re-submit) a sitemap for a property. LIVE HTTP:
   * `PUT webmasters/v3/sites/{encoded siteUrl}/sitemaps/{encoded feedpath}` with an empty body.
   *
   * Requires the read-WRITE `webmasters` scope ({@link GSC_SITEMAPS_SCOPE}) — the read-only scope
   * this package defaults to cannot mutate sitemaps, so the token must have been granted that scope
   * at consent time. A 2xx response (the API returns no body) resolves; any non-2xx throws
   * {@link GoogleApiError} via {@link requestJson}.
   */
  async submitSitemap(siteUrl: string, feedpath: string): Promise<void> {
    const url =
      `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}` +
      `/sitemaps/${encodeURIComponent(feedpath)}`;

    await requestJson(this.fetcher, url, {
      method: 'PUT',
      accessToken: this.accessToken,
    });
  }

  /**
   * Inspect a URL's Google index status. LIVE HTTP: POSTs `{ inspectionUrl, siteUrl }` to
   * `v1/urlInspection/index:inspect`. Works with the read-only scope; quota is ~2,000
   * inspections per property per day. `siteUrl` must be the exact property string and
   * `inspectionUrl` must belong to it.
   */
  async inspectUrl(siteUrl: string, inspectionUrl: string): Promise<GscUrlInspection> {
    const json = await requestJson(this.fetcher, GSC_INSPECT_URL, {
      method: 'POST',
      accessToken: this.accessToken,
      body: { inspectionUrl, siteUrl },
    });
    return mapInspection(json);
  }
}

/** Map a raw `index:inspect` response's `indexStatusResult` into {@link GscUrlInspection}. */
export function mapInspection(json: unknown): GscUrlInspection {
  const r = asRecord(asRecord(asRecord(json)['inspectionResult'])['indexStatusResult']);
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(asString) : []);
  return {
    verdict: asString(r['verdict']),
    coverageState: asString(r['coverageState']),
    indexingState: asString(r['indexingState']),
    robotsTxtState: asString(r['robotsTxtState']),
    pageFetchState: asString(r['pageFetchState']),
    lastCrawlTime: asString(r['lastCrawlTime']),
    googleCanonical: asString(r['googleCanonical']),
    userCanonical: asString(r['userCanonical']),
    sitemap: strings(r['sitemap']),
    referringUrlCount: strings(r['referringUrls']).length,
  };
}

/** Map a raw `searchAnalytics.query` JSON response into the {@link GscReport} contract. */
function mapQuery(json: unknown): GscReport {
  const root = asRecord(json);
  const rows: GscRow[] = asRecordArray(root['rows']).map((row) => {
    const keysRaw = row['keys'];
    const keys = Array.isArray(keysRaw) ? keysRaw.map(asString) : [];
    return {
      keys,
      clicks: asNumber(row['clicks']),
      impressions: asNumber(row['impressions']),
      ctr: asNumber(row['ctr']),
      position: asNumber(row['position']),
    };
  });
  return { rows };
}
