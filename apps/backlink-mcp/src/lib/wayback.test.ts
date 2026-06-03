import { describe, it, expect } from 'vitest';
import { parseCdx, timestampToIso, buildCdxUrl, fetchHistory } from './wayback.js';
import type { HttpClient, TextResponse } from './http.js';

const CDX_JSON = JSON.stringify([
  ['timestamp', 'original', 'statuscode', 'mimetype'],
  ['20180101120000', 'https://example.com/', '200', 'text/html'],
  ['20210615093000', 'https://example.com/', '200', 'text/html'],
]);

function httpReturning(res: TextResponse): HttpClient {
  return {
    getText: async () => res,
    getResource: async () => {
      throw new Error('not used');
    },
  };
}

describe('timestampToIso', () => {
  it('converts a 14-digit timestamp to ISO-8601', () => {
    expect(timestampToIso('20210615093000')).toBe('2021-06-15T09:30:00Z');
  });
  it('returns undefined for malformed timestamps', () => {
    expect(timestampToIso('2021')).toBeUndefined();
    expect(timestampToIso('not-a-date')).toBeUndefined();
  });
});

describe('buildCdxUrl', () => {
  it('targets the CDX endpoint with json output and a limit', () => {
    const url = buildCdxUrl('https://example.com/', 25);
    expect(url).toContain('web.archive.org/cdx/search/cdx');
    expect(url).toContain('output=json');
    expect(url).toContain('limit=25');
  });
});

describe('parseCdx', () => {
  it('skips the header row and builds snapshots with archive urls', () => {
    const snaps = parseCdx(JSON.parse(CDX_JSON));
    expect(snaps).toHaveLength(2);
    expect(snaps[0]?.timestamp).toBe('20180101120000');
    expect(snaps[0]?.archiveUrl).toBe(
      'http://web.archive.org/web/20180101120000/https://example.com/',
    );
    expect(snaps[1]?.iso).toBe('2021-06-15T09:30:00Z');
  });

  it('returns an empty array for a header-only or non-array body', () => {
    expect(parseCdx([['timestamp', 'original']])).toEqual([]);
    expect(parseCdx({})).toEqual([]);
    expect(parseCdx(null)).toEqual([]);
  });
});

describe('fetchHistory', () => {
  it('summarises first/last and total from a good response', async () => {
    const outcome = await fetchHistory(
      httpReturning({ ok: true, status: 200, body: CDX_JSON, url: 'x' }),
      'https://example.com/',
    );
    expect(outcome.totalSnapshots).toBe(2);
    expect(outcome.first?.timestamp).toBe('20180101120000');
    expect(outcome.last?.timestamp).toBe('20210615093000');
    expect(outcome.warnings).toEqual([]);
  });

  it('degrades with a warning when CDX returns non-JSON', async () => {
    const outcome = await fetchHistory(
      httpReturning({ ok: true, status: 200, body: 'Server Error', url: 'x' }),
      'https://example.com/',
    );
    expect(outcome.totalSnapshots).toBe(0);
    expect(outcome.warnings.join(' ')).toMatch(/unparseable/i);
  });

  it('degrades with a warning on a failed request', async () => {
    const outcome = await fetchHistory(
      httpReturning({ ok: false, status: 0, body: '', url: 'x' }),
      'https://example.com/',
    );
    expect(outcome.totalSnapshots).toBe(0);
    expect(outcome.warnings.join(' ')).toMatch(/failed/i);
  });
});
