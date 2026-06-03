/**
 * Wayback Machine CDX API adapter.
 *
 * The Internet Archive's CDX server returns a snapshot index for a URL at
 * `http://web.archive.org/cdx/search/cdx?url=<url>&output=json`. The JSON body is
 * a row-oriented array: the first row is the column header, subsequent rows are
 * snapshot records. We parse it into typed snapshots. Never throws — malformed or
 * blocked responses degrade to an empty timeline plus a warning.
 */
import type { HttpClient } from './http.js';

export interface WaybackSnapshot {
  /** 14-digit timestamp, e.g. `20210501123000`. */
  timestamp: string;
  /** ISO-8601 form derived from the timestamp, when parseable. */
  iso?: string;
  original: string;
  statusCode: string;
  mimeType: string;
  /** Direct link to the archived snapshot. */
  archiveUrl: string;
}

export interface WaybackOutcome {
  url: string;
  totalSnapshots: number;
  first?: WaybackSnapshot;
  last?: WaybackSnapshot;
  snapshots: WaybackSnapshot[];
  warnings: string[];
}

const CDX_ENDPOINT = 'http://web.archive.org/cdx/search/cdx';

/** Build the CDX query URL. We request the fields we use, collapsed by digest. */
export function buildCdxUrl(url: string, limit: number): string {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,original,statuscode,mimetype',
    collapse: 'digest',
    limit: String(limit),
  });
  return `${CDX_ENDPOINT}?${params.toString()}`;
}

/** Convert a 14-digit CDX timestamp to an ISO string, or undefined if malformed. */
export function timestampToIso(ts: string): string | undefined {
  if (!/^\d{14}$/.test(ts)) return undefined;
  const y = ts.slice(0, 4);
  const mo = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const h = ts.slice(8, 10);
  const mi = ts.slice(10, 12);
  const s = ts.slice(12, 14);
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? undefined : iso;
}

/** Narrow an unknown CDX cell to a trimmed string. */
function cell(row: unknown[], index: number): string {
  const value = row[index];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/**
 * Parse the CDX JSON body (already `JSON.parse`d into `unknown`) into snapshots.
 * The first row is a header and is skipped. Pure and exported for unit testing.
 */
export function parseCdx(parsed: unknown): WaybackSnapshot[] {
  if (!Array.isArray(parsed) || parsed.length <= 1) return [];
  const snapshots: WaybackSnapshot[] = [];

  // Row layout follows the `fl` order: timestamp, original, statuscode, mimetype.
  for (let i = 1; i < parsed.length; i += 1) {
    const row = parsed[i];
    if (!Array.isArray(row)) continue;
    const timestamp = cell(row, 0);
    const original = cell(row, 1);
    if (timestamp === '' || original === '') continue;
    const snapshot: WaybackSnapshot = {
      timestamp,
      original,
      statusCode: cell(row, 2),
      mimeType: cell(row, 3),
      archiveUrl: `http://web.archive.org/web/${timestamp}/${original}`,
    };
    const iso = timestampToIso(timestamp);
    if (iso) snapshot.iso = iso;
    snapshots.push(snapshot);
  }

  return snapshots;
}

/** Fetch and summarise a URL's Wayback history. Never throws. */
export async function fetchHistory(
  http: HttpClient,
  url: string,
  limit = 50,
): Promise<WaybackOutcome> {
  const warnings: string[] = [];
  const res = await http.getText(buildCdxUrl(url, limit), { accept: 'application/json' });

  if (!res.ok || res.body === '') {
    warnings.push(`Wayback CDX request failed (status ${res.status}). No history available.`);
    return { url, totalSnapshots: 0, snapshots: [], warnings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    // STUB: CDX occasionally returns a non-JSON error body under load.
    warnings.push('Wayback CDX returned an unparseable body. No history available.');
    return { url, totalSnapshots: 0, snapshots: [], warnings };
  }

  const snapshots = parseCdx(parsed);
  if (snapshots.length === 0) {
    warnings.push('No archived snapshots found for this URL.');
    return { url, totalSnapshots: 0, snapshots: [], warnings };
  }

  return {
    url,
    totalSnapshots: snapshots.length,
    first: snapshots[0],
    last: snapshots[snapshots.length - 1],
    snapshots,
    warnings,
  };
}
