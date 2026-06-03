import { describe, it, expect } from 'vitest';
import { parseResults, unwrapRedirect, buildSearchUrl, search } from './duckduckgo.js';
import type { HttpClient, TextResponse } from './http.js';

const SAMPLE_HTML = `
<div class="results">
  <div class="result">
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpost&rut=abc">Example Post</a>
    <a class="result__snippet">A snippet about the example post.</a>
  </div>
  <div class="result">
    <a class="result__a" href="https://direct.example/article">Direct Article</a>
    <div class="result__snippet">Another snippet.</div>
  </div>
  <div class="result">
    <span>no anchor here</span>
  </div>
</div>
`;

const BLOCK_HTML = `<html><body>If this error persists, please let us know: bots use DuckDuckGo too. anomaly detected.</body></html>`;

function httpReturning(res: TextResponse): HttpClient {
  return {
    getText: async () => res,
    getResource: async () => {
      throw new Error('not used');
    },
  };
}

describe('buildSearchUrl', () => {
  it('encodes the query into the DDG html endpoint', () => {
    const url = buildSearchUrl('acme corp "review"');
    expect(url.startsWith('https://html.duckduckgo.com/html/?q=')).toBe(true);
    expect(url).toContain('acme+corp');
  });
});

describe('unwrapRedirect', () => {
  it('unwraps the uddg redirect param back to the real target', () => {
    const wrapped = '//duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.com%2Fa%3Fb%3Dc&rut=x';
    expect(unwrapRedirect(wrapped)).toBe('https://target.com/a?b=c');
  });

  it('passes through non-redirect hrefs (normalising protocol-relative)', () => {
    expect(unwrapRedirect('https://plain.com/x')).toBe('https://plain.com/x');
    expect(unwrapRedirect('//plain.com/x')).toBe('https://plain.com/x');
  });
});

describe('parseResults', () => {
  it('parses result anchors and unwraps redirected urls', () => {
    const results = parseResults(SAMPLE_HTML);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: 'Example Post',
      url: 'https://example.com/post',
      snippet: 'A snippet about the example post.',
    });
    expect(results[1]?.url).toBe('https://direct.example/article');
  });

  it('returns an empty array when markup does not match (degrades, no throw)', () => {
    expect(parseResults('<div>totally different</div>')).toEqual([]);
  });
});

describe('search', () => {
  it('returns parsed results with no warnings on a good response', async () => {
    const http = httpReturning({ ok: true, status: 200, body: SAMPLE_HTML, url: 'x' });
    const outcome = await search(http, 'example', 10);
    expect(outcome.results).toHaveLength(2);
    expect(outcome.warnings).toEqual([]);
  });

  it('degrades with a warning on a block page', async () => {
    const http = httpReturning({ ok: true, status: 200, body: BLOCK_HTML, url: 'x' });
    const outcome = await search(http, 'example', 10);
    expect(outcome.results).toEqual([]);
    expect(outcome.warnings.join(' ')).toMatch(/block|anomaly/i);
  });

  it('degrades with a warning on a transport failure', async () => {
    const http = httpReturning({ ok: false, status: 0, body: '', url: 'x' });
    const outcome = await search(http, 'example', 10);
    expect(outcome.results).toEqual([]);
    expect(outcome.warnings.join(' ')).toMatch(/failed/i);
  });

  it('warns on an empty query without hitting the network', async () => {
    let called = false;
    const http: HttpClient = {
      getText: async () => {
        called = true;
        return { ok: true, status: 200, body: SAMPLE_HTML, url: 'x' };
      },
      getResource: async () => {
        throw new Error('unused');
      },
    };
    const outcome = await search(http, '   ', 10);
    expect(called).toBe(false);
    expect(outcome.results).toEqual([]);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });
});
