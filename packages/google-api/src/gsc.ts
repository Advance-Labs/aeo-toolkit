/**
 * Google Search Console client (searchconsole.googleapis.com webmasters v3).
 *
 * Wraps `searchAnalytics.query` and `sites.list`. All HTTP flows through an injectable
 * {@link Fetcher} so the logic is unit-testable without a live network.
 */
import type { GscQueryRequest, GscReport, GscRow, GscSite } from '@aeo/types';
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
   * STUB: submit a sitemap for a property.
   *
   * The live call is `PUT webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}` and requires the
   * read-WRITE `webmasters` scope (not the read-only scope this package defaults to), so it is
   * intentionally left unwired. The seam is typed so the wiring point is obvious: PUT the encoded
   * feedpath under the encoded siteUrl with an empty body and treat a 2xx as success.
   */
  // STUB: live sitemap submission not wired — requires read-write scope.
  async submitSitemap(_siteUrl: string, _feedpath: string): Promise<void> {
    throw new Error(
      'GscClient.submitSitemap is not implemented: requires the read-write `webmasters` scope',
    );
  }
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
