import { describe, it, expect } from 'vitest';
import {
  parseCdx,
  timestampToIso,
  buildCdxUrl,
  buildDomainCdxUrl,
  fetchHistory,
  queryDomainCaptures,
} from './wayback.js';
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
      'https://web.archive.org/web/20180101120000/https://example.com/',
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

describe('buildDomainCdxUrl', () => {
  it('queries the whole domain (matchType=domain) collapsed to distinct urls', () => {
    const url = buildDomainCdxUrl('example.com', 25);
    expect(url).toContain('web.archive.org/cdx/search/cdx');
    expect(url).toContain('url=example.com');
    expect(url).toContain('matchType=domain');
    expect(url).toContain('collapse=urlkey');
    expect(url).toContain('output=json');
    expect(url).toContain('limit=25');
  });
});

describe('queryDomainCaptures', () => {
  const DOMAIN_CDX = JSON.stringify([
    ['timestamp', 'original'],
    ['20230115120000', 'https://example.com/features'],
    ['20240620090000', 'https://www.example.com/changelog'],
    // Duplicate original — collapsed to one capture.
    ['20250101000000', 'https://example.com/features'],
  ]);

  it('parses distinct domain captures with host + timestamp', async () => {
    const outcome = await queryDomainCaptures(
      httpReturning({ ok: true, status: 200, body: DOMAIN_CDX, url: 'x' }),
      'example.com',
    );
    expect(outcome.captures).toHaveLength(2);
    expect(outcome.captures[0]).toEqual({
      url: 'https://example.com/features',
      host: 'example.com',
      timestamp: '20230115120000',
    });
    // `www.` is stripped from the host.
    expect(outcome.captures[1]?.host).toBe('example.com');
    expect(outcome.warnings).toEqual([]);
  });

  it('warns without hitting the network on an empty domain', async () => {
    let called = false;
    const http: HttpClient = {
      getText: async () => {
        called = true;
        return { ok: true, status: 200, body: DOMAIN_CDX, url: 'x' };
      },
      getResource: async () => {
        throw new Error('unused');
      },
    };
    const outcome = await queryDomainCaptures(http, '   ');
    expect(called).toBe(false);
    expect(outcome.captures).toEqual([]);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });

  it('degrades with a warning on a transport failure', async () => {
    const outcome = await queryDomainCaptures(
      httpReturning({ ok: false, status: 0, body: '', url: 'x' }),
      'example.com',
    );
    expect(outcome.captures).toEqual([]);
    expect(outcome.warnings.join(' ')).toMatch(/failed/i);
  });

  it('degrades with a warning on an unparseable body', async () => {
    const outcome = await queryDomainCaptures(
      httpReturning({ ok: true, status: 200, body: '<html>error</html>', url: 'x' }),
      'example.com',
    );
    expect(outcome.captures).toEqual([]);
    expect(outcome.warnings.join(' ')).toMatch(/unparseable|no archived/i);
  });
});
