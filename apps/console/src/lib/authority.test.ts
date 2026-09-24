import { describe, expect, it, vi } from 'vitest';
import {
  AuthorityError,
  MAX_DOMAINS_PER_LOOKUP,
  lookupAuthority,
  normalizeDomain,
  parseAuthorityResponse,
} from './authority';

/**
 * A real captured response, trimmed. Verified against the live API on 2026-09-24
 * with `semrush.com` (open_page_rank 8.9, rank 673, 32,815 referring domains,
 * 105 history points from 2018-01-01) — the numbers below are that call's, so the
 * fixture encodes the service's actual shape rather than a reading of its docs.
 *
 * Note `date` is a full ISO day (`2026-09-01`), not a `YYYY-MM` month.
 */
const OK_BODY = {
  as_of: '2026-09-01',
  count: 1,
  results: [
    {
      domain: 'semrush.com',
      found: true,
      open_page_rank: 8.9,
      rank: 673,
      referring_domains: 32_815,
      history: [
        { date: '2026-09-01', open_page_rank: 8.9, estimated: false },
        // Deliberately out of order: the parser must sort, because the UI draws
        // the series straight off the array.
        { date: '2018-01-01', open_page_rank: 8.63, estimated: false },
        { date: '2018-02-01', open_page_rank: 8.63, estimated: true },
      ],
    },
  ],
  invalid: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ENV = { OPENPAGERANK_API_KEY: 'opr_live_test' };

describe('normalizeDomain', () => {
  it.each([
    ['advancelabs.dev', 'advancelabs.dev'],
    ['https://advancelabs.dev', 'advancelabs.dev'],
    ['HTTPS://WWW.AdvanceLabs.dev/pricing?a=1', 'advancelabs.dev'],
    ['  advancelabs.dev  ', 'advancelabs.dev'],
    ['http://sub.advancelabs.dev/x', 'sub.advancelabs.dev'],
  ])('reduces %j to %j', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(['', '   ', 'localhost', '127.0.0.1', 'not a domain', '://'])('rejects %j', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });

  it('collapses www and naked to one key', () => {
    // The whole point: these must not be two lookups, or the tool reports
    // "not found" for a site that is plainly in the graph.
    expect(normalizeDomain('www.advancelabs.dev')).toBe(normalizeDomain('advancelabs.dev'));
  });
});

describe('parseAuthorityResponse', () => {
  it('maps the documented shape onto the result type', () => {
    const report = parseAuthorityResponse(OK_BODY);
    expect(report.asOf).toBe('2026-09-01');
    expect(report.source).toBe('open-pagerank');
    const [row] = report.results;
    expect(row).toMatchObject({
      domain: 'semrush.com',
      found: true,
      openPageRank: 8.9,
      rank: 673,
      referringDomains: 32_815,
    });
  });

  it('returns history oldest-first', () => {
    const [row] = parseAuthorityResponse(OK_BODY).results;
    expect(row?.history.map((h) => h.date)).toEqual(['2018-01-01', '2018-02-01', '2026-09-01']);
    expect(row?.history[1]?.estimated).toBe(true);
  });

  it('reports a domain absent from the graph as found:false with a null score', () => {
    // Not zero. A domain the graph has never seen has no score, and rendering
    // a 0 would be a fabricated number.
    // This is the literal shape the live API returns for an unknown domain:
    // `found: false` with every metric explicitly null, not omitted.
    const report = parseAuthorityResponse({
      as_of: '2026-09-01',
      results: [
        {
          domain: 'nowhere.example',
          found: false,
          open_page_rank: null,
          rank: null,
          referring_domains: null,
        },
      ],
    });
    expect(report.results[0]).toMatchObject({ found: false, openPageRank: null });
  });

  it.each([
    ['a non-object body', 'nope'],
    ['a body with no results array', { as_of: '2026-09-01' }],
    ['a result that is not an object', { results: ['advancelabs.dev'] }],
    ['a result with no domain', { results: [{ open_page_rank: 3.4 }] }],
  ])('throws upstream_shape on %s', (_label, body) => {
    // The API host moved and this schema is transcribed from docs, not observed.
    // A rename must fail loudly here rather than render a blank as a score.
    expect(() => parseAuthorityResponse(body)).toThrowError(
      expect.objectContaining({ code: 'upstream_shape' }),
    );
  });

  it('skips malformed history points instead of failing the whole lookup', () => {
    const report = parseAuthorityResponse({
      as_of: '2026-09-01',
      results: [
        {
          domain: 'advancelabs.dev',
          found: true,
          open_page_rank: 1.35,
          history: [{ date: '2026-09-01', open_page_rank: 1.35 }, null, { date: '2026-08-01' }],
        },
      ],
    });
    expect(report.results[0]?.history).toHaveLength(1);
  });
});

describe('lookupAuthority', () => {
  it('throws not_configured when no API key is set', async () => {
    await expect(lookupAuthority(['advancelabs.dev'], { env: {} })).rejects.toThrowError(
      expect.objectContaining({ code: 'not_configured' }),
    );
  });

  it('never puts the API key anywhere but the Authorization header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OK_BODY));
    await lookupAuthority(['advancelabs.dev'], { env: ENV, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('opr_live_test');
    expect(String(init.body)).not.toContain('opr_live_test');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer opr_live_test');
  });

  it('de-duplicates after normalizing, so quota is not spent twice', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OK_BODY));
    await lookupAuthority(
      ['advancelabs.dev', 'https://www.advancelabs.dev/pricing', 'ADVANCELABS.DEV'],
      { env: ENV, fetchImpl },
    );
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.domains).toEqual(['advancelabs.dev']);
  });

  it('caps the batch at the upstream limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OK_BODY));
    const many = Array.from({ length: 150 }, (_, i) => `site-${i}.example`);
    await lookupAuthority(many, { env: ENV, fetchImpl });
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.domains).toHaveLength(MAX_DOMAINS_PER_LOOKUP);
  });

  it('throws bad_input when nothing normalizes', async () => {
    const fetchImpl = vi.fn();
    await expect(
      lookupAuthority(['localhost', 'not a domain'], { env: ENV, fetchImpl }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'bad_input' }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a non-2xx to upstream_rejected without leaking the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'quota' }, 429));
    const error = await lookupAuthority(['advancelabs.dev'], { env: ENV, fetchImpl }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AuthorityError);
    expect((error as AuthorityError).code).toBe('upstream_rejected');
    expect((error as AuthorityError).message).toContain('429');
  });

  it('maps a network failure to unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      lookupAuthority(['advancelabs.dev'], { env: ENV, fetchImpl }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'unreachable' }));
  });

  it('maps an abort to unreachable, reported as a timeout', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(abort);
    const error = await lookupAuthority(['advancelabs.dev'], { env: ENV, fetchImpl }).catch(
      (e: unknown) => e,
    );
    expect((error as AuthorityError).code).toBe('unreachable');
    expect((error as AuthorityError).message).toContain('timed out');
  });

  it('asks for history by default and honours includeHistory:false', async () => {
    // A fresh Response per call: a Response body is a one-shot stream, so reusing
    // one mockResolvedValue object makes the SECOND call fail on an empty body.
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(OK_BODY));
    await lookupAuthority(['advancelabs.dev'], { env: ENV, fetchImpl });
    let body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.include_history).toBe(true);

    await lookupAuthority(['advancelabs.dev'], { env: ENV, fetchImpl, includeHistory: false });
    body = JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body));
    expect(body.include_history).toBe(false);
  });
});
