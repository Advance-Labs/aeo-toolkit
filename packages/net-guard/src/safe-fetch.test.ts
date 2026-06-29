import { describe, it, expect, vi } from 'vitest';
import { safeFetch, type SafeFetchDeps } from './safe-fetch.js';

function deps(over: Partial<SafeFetchDeps> = {}): SafeFetchDeps {
  return {
    resolve: async () => ['8.8.8.8'],
    fetchImpl: async () => ({ status: 200, body: 'hello' }),
    ...over,
  };
}

describe('safeFetch', () => {
  it('rejects a non-http(s) scheme before touching DNS or the network', async () => {
    const resolve = vi.fn(async () => ['8.8.8.8']);
    const fetchImpl = vi.fn(async () => ({ status: 200, body: '' }));
    const r = await safeFetch('file:///etc/passwd', {}, deps({ resolve, fetchImpl }));
    expect(r.ok).toBe(false);
    expect(r.blockedReason).toBe('scheme-not-allowed');
    expect(resolve).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks a host that resolves to a private address (before fetching)', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, body: '' }));
    const r = await safeFetch('http://metadata.test/', {}, deps({
      resolve: async () => ['169.254.169.254'],
      fetchImpl,
    }));
    expect(r.ok).toBe(false);
    expect(r.blockedReason).toBe('private-address');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks when ANY resolved address is private (DNS-rebind defense)', async () => {
    const r = await safeFetch('http://x.test/', {}, deps({
      resolve: async () => ['8.8.8.8', '127.0.0.1'],
    }));
    expect(r.blockedReason).toBe('private-address');
  });

  it('fetches a public host and returns the body', async () => {
    const r = await safeFetch('https://example.com/', {}, deps());
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.body).toBe('hello');
  });

  it('re-validates the redirect target and blocks a redirect to an internal host', async () => {
    const resolve = async (host: string) =>
      host === 'internal.test' ? ['169.254.169.254'] : ['8.8.8.8'];
    const fetchImpl = async (url: string) =>
      url.includes('internal.test')
        ? { status: 200, body: 'secret' }
        : { status: 302, body: '', location: 'http://internal.test/' };
    const r = await safeFetch('http://evil.test/', {}, deps({ resolve, fetchImpl }));
    expect(r.ok).toBe(false);
    expect(r.blockedReason).toBe('private-address');
  });

  it('gives up after maxRedirects hops', async () => {
    let n = 0;
    const fetchImpl = async () => ({ status: 302, body: '', location: `http://h${n++}.test/` });
    const r = await safeFetch('http://start.test/', { maxRedirects: 3 }, deps({ fetchImpl }));
    expect(r.blockedReason).toBe('too-many-redirects');
  });

  it('reports DNS resolution failure (throw or empty result)', async () => {
    const thrown = await safeFetch('http://x.test/', {}, deps({
      resolve: async () => { throw new Error('ENOTFOUND'); },
    }));
    expect(thrown.blockedReason).toBe('dns-resolution-failed');

    const empty = await safeFetch('http://x.test/', {}, deps({ resolve: async () => [] }));
    expect(empty.blockedReason).toBe('dns-resolution-failed');
  });

  it('rejects an over-large body', async () => {
    const r = await safeFetch('http://x.test/', { maxBodyBytes: 4 }, deps({
      fetchImpl: async () => ({ status: 200, body: 'hello' }), // 5 bytes
    }));
    expect(r.ok).toBe(false);
    expect(r.blockedReason).toBe('body-too-large');
  });

  it('times out a hanging request and aborts it', async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const fetchImpl: SafeFetchDeps['fetchImpl'] = (_url, signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => { aborted = true; });
          // never resolves on its own
        });
      const p = safeFetch('http://slow.test/', { timeoutMs: 1000 }, deps({ fetchImpl }));
      await vi.advanceTimersByTimeAsync(1000);
      const r = await p;
      expect(r.blockedReason).toBe('timeout');
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
