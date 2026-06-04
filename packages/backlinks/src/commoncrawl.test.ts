import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildIndexUrl,
  parseNdjson,
  queryIndex,
  resolveLatestIndex,
  resetLatestIndexCache,
  DEFAULT_CC_INDEX,
} from './commoncrawl.js';
import type { HttpClient, TextResponse } from './http.js';

const NDJSON = [
  JSON.stringify({
    url: 'https://review.blog/acme-review',
    status: '200',
    mime: 'text/html',
    timestamp: '20241201120000',
  }),
  JSON.stringify({ url: 'https://news.example/acme', status: '200', 'mime-detected': 'text/html' }),
  // A second capture on an already-seen host (de-dup is the caller's job).
  JSON.stringify({ url: 'https://review.blog/another', status: '200' }),
].join('\n');

function httpReturning(res: TextResponse): HttpClient {
  return {
    getText: async () => res,
    getResource: async () => {
      throw new Error('not used');
    },
  };
}

describe('buildIndexUrl', () => {
  it('targets the CommonCrawl index with a host wildcard, json output, and limit', () => {
    const url = buildIndexUrl('acme.com', DEFAULT_CC_INDEX, 25);
    expect(url).toContain(`index.commoncrawl.org/${DEFAULT_CC_INDEX}-index`);
    expect(url).toContain('output=json');
    expect(url).toContain('limit=25');
    // The domain wildcard `*` is sent raw — the CommonCrawl CDX index treats it as a prefix wildcard.
    expect(url).toContain('url=acme.com*');
  });
});

describe('resolveLatestIndex', () => {
  beforeEach(() => resetLatestIndexCache());

  const collinfo = JSON.stringify([
    { id: 'CC-MAIN-2026-21', name: 'May 2026 Index', 'cdx-api': 'x' },
    { id: 'CC-MAIN-2026-17', name: 'April 2026 Index', 'cdx-api': 'y' },
  ]);

  it('returns the newest (first) index id from collinfo.json', async () => {
    const id = await resolveLatestIndex(
      httpReturning({ ok: true, status: 200, body: collinfo, url: 'x' }),
    );
    expect(id).toBe('CC-MAIN-2026-21');
  });

  it('caches the resolved id so it only fetches once per process', async () => {
    let calls = 0;
    const http: HttpClient = {
      getText: async () => {
        calls += 1;
        return { ok: true, status: 200, body: collinfo, url: 'x' };
      },
      getResource: async () => {
        throw new Error('unused');
      },
    };
    expect(await resolveLatestIndex(http)).toBe('CC-MAIN-2026-21');
    expect(await resolveLatestIndex(http)).toBe('CC-MAIN-2026-21');
    expect(calls).toBe(1);
  });

  it('falls back to DEFAULT_CC_INDEX on a transport failure (and does not cache it)', async () => {
    let ok = false;
    const http: HttpClient = {
      getText: async () => {
        const res: TextResponse = ok
          ? { ok: true, status: 200, body: collinfo, url: 'x' }
          : { ok: false, status: 0, body: '', url: 'x' };
        return res;
      },
      getResource: async () => {
        throw new Error('unused');
      },
    };
    expect(await resolveLatestIndex(http)).toBe(DEFAULT_CC_INDEX);
    // A later successful lookup still resolves the real latest (fallback wasn't cached).
    ok = true;
    expect(await resolveLatestIndex(http)).toBe('CC-MAIN-2026-21');
  });

  it('falls back to DEFAULT_CC_INDEX on a non-array / unexpected body', async () => {
    const id = await resolveLatestIndex(
      httpReturning({ ok: true, status: 200, body: '{"not":"an array"}', url: 'x' }),
    );
    expect(id).toBe(DEFAULT_CC_INDEX);
  });
});

describe('parseNdjson', () => {
  it('parses one capture per line and extracts the normalised host', () => {
    const { captures, malformed } = parseNdjson(NDJSON);
    expect(malformed).toBe(0);
    expect(captures).toHaveLength(3);
    expect(captures[0]).toEqual({
      url: 'https://review.blog/acme-review',
      host: 'review.blog',
      status: '200',
      mime: 'text/html',
      timestamp: '20241201120000',
    });
    // `mime-detected` is read as a fallback for `mime`.
    expect(captures[1]?.mime).toBe('text/html');
  });

  it('skips malformed and non-object lines without throwing (graceful degradation)', () => {
    const mixed = [
      JSON.stringify({ url: 'https://good.example/x', status: '200' }),
      '{not valid json',
      '[1,2,3]', // valid JSON but not an object record
      JSON.stringify({ status: '200' }), // missing url
      JSON.stringify({ url: 'not-a-url' }), // unparseable host
      '   ', // blank line
      JSON.stringify({ url: 'https://good.example/y', status: '200' }),
    ].join('\n');

    const { captures, malformed } = parseNdjson(mixed);
    expect(captures).toHaveLength(2);
    expect(captures.map((c) => c.url)).toEqual([
      'https://good.example/x',
      'https://good.example/y',
    ]);
    // 1 invalid JSON + 1 array + 1 missing-url + 1 bad-host = 4 malformed (blank skipped silently).
    expect(malformed).toBe(4);
  });
});

describe('queryIndex', () => {
  it('returns captures with no warnings on a clean NDJSON response', async () => {
    const outcome = await queryIndex(
      httpReturning({ ok: true, status: 200, body: NDJSON, url: 'x' }),
      'acme.com',
    );
    expect(outcome.captures).toHaveLength(3);
    expect(outcome.warnings).toEqual([]);
  });

  it('honors the limit when slicing captures', async () => {
    const outcome = await queryIndex(
      httpReturning({ ok: true, status: 200, body: NDJSON, url: 'x' }),
      'acme.com',
      { limit: 2 },
    );
    expect(outcome.captures).toHaveLength(2);
  });

  it('degrades with a warning and partial captures when some lines are malformed', async () => {
    const body = [
      JSON.stringify({ url: 'https://ok.example/a', status: '200' }),
      'garbage-line-not-json',
      JSON.stringify({ url: 'https://ok.example/b', status: '200' }),
    ].join('\n');
    const outcome = await queryIndex(
      httpReturning({ ok: true, status: 200, body, url: 'x' }),
      'ok.example',
    );
    expect(outcome.captures).toHaveLength(2);
    expect(outcome.warnings.join(' ')).toMatch(/malformed/i);
  });

  it('degrades with a warning on a transport failure', async () => {
    const outcome = await queryIndex(
      httpReturning({ ok: false, status: 0, body: '', url: 'x' }),
      'acme.com',
    );
    expect(outcome.captures).toEqual([]);
    expect(outcome.warnings.join(' ')).toMatch(/failed/i);
  });

  it('degrades with a warning on a "No Captures found" coverage page', async () => {
    const outcome = await queryIndex(
      httpReturning({ ok: true, status: 200, body: 'No Captures found for: acme.com*', url: 'x' }),
      'acme.com',
    );
    expect(outcome.captures).toEqual([]);
    expect(outcome.warnings.join(' ')).toMatch(/no captures|rate-limit/i);
  });

  it('warns on an empty domain without hitting the network', async () => {
    let called = false;
    const http: HttpClient = {
      getText: async () => {
        called = true;
        return { ok: true, status: 200, body: NDJSON, url: 'x' };
      },
      getResource: async () => {
        throw new Error('unused');
      },
    };
    const outcome = await queryIndex(http, '   ');
    expect(called).toBe(false);
    expect(outcome.captures).toEqual([]);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });
});
