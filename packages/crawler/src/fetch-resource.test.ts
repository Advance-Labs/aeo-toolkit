import { describe, it, expect } from 'vitest';
import { fetchResource } from './fetch-resource.js';
import { makeFetcher, makeResponse } from './test-helpers.js';
import type { Fetcher } from './fetcher.js';

describe('fetchResource', () => {
  it('returns a successful resource with status, headers, body and content-type', async () => {
    const { fetcher } = makeFetcher({
      'https://example.com/': {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<html>hi</html>',
      },
    });

    const res = await fetchResource('https://example.com/', { fetcher });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.finalUrl).toBe('https://example.com/');
    expect(res.contentType).toBe('text/html; charset=utf-8');
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.body).toBe('<html>hi</html>');
    expect(res.redirectChain).toEqual([]);
    expect(res.timingMs).toBeGreaterThanOrEqual(0);
  });

  it('captures the redirect chain and resolves to the final URL', async () => {
    const fetcher: Fetcher = (url) => {
      if (url === 'https://example.com/a') {
        return Promise.resolve(
          makeResponse({ status: 301, headers: { location: 'https://example.com/b' } }),
        );
      }
      if (url === 'https://example.com/b') {
        return Promise.resolve(makeResponse({ status: 302, headers: { location: '/c' } }));
      }
      return Promise.resolve(makeResponse({ status: 200, body: 'final' }));
    };

    const res = await fetchResource('https://example.com/a', { fetcher });

    expect(res.status).toBe(200);
    expect(res.finalUrl).toBe('https://example.com/c');
    expect(res.redirectChain).toEqual([
      { url: 'https://example.com/a', status: 301 },
      { url: 'https://example.com/b', status: 302 },
    ]);
    expect(res.body).toBe('final');
  });

  it('stops at the redirect cap and returns the last redirect as terminal (edge case)', async () => {
    // Always redirect to keep the loop going past the cap.
    let n = 0;
    const fetcher: Fetcher = () => {
      n += 1;
      return Promise.resolve(
        makeResponse({ status: 302, headers: { location: `https://example.com/${n}` } }),
      );
    };

    const res = await fetchResource('https://example.com/start', {
      fetcher,
      maxRedirects: 2,
    });

    expect(res.status).toBe(302);
    expect(res.redirectChain).toHaveLength(3); // start + 2 hops
  });

  it('does a HEAD request without reading a body', async () => {
    const { fetcher, calls } = makeFetcher({
      'https://example.com/favicon.ico': {
        status: 200,
        headers: { 'content-type': 'image/x-icon' },
      },
    });

    const res = await fetchResource('https://example.com/favicon.ico', {
      fetcher,
      method: 'HEAD',
    });

    expect(res.ok).toBe(true);
    expect(res.body).toBeUndefined();
    expect(calls[0]?.method).toBe('HEAD');
  });

  it('returns a non-ok resource with an error string when the fetcher throws (edge case)', async () => {
    const fetcher: Fetcher = () => Promise.reject(new Error('ECONNREFUSED'));
    const res = await fetchResource('https://example.com/', { fetcher });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error).toBe('ECONNREFUSED');
  });

  it('reports a timeout as a typed error message (edge case)', async () => {
    const fetcher: Fetcher = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

    const res = await fetchResource('https://example.com/', {
      fetcher,
      requestTimeoutMs: 5,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe('request timed out');
  });
});
