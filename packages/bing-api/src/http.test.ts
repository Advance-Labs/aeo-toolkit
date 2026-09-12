import { describe, expect, it, vi } from 'vitest';
import { BingApiError, requestBing, type FetchInit, type FetchResponse } from './http.js';

const BASE = 'https://ssl.bing.com/webmaster/api.svc/json/';

function ok(body: unknown): FetchResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function fail(status: number, body: string): FetchResponse {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({}),
    text: async () => body,
  };
}

describe('requestBing', () => {
  it('injects the apikey and the named method into the URL', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: FetchInit) => ok({ d: [] }));
    await requestBing(fetcher, {
      baseUrl: BASE,
      method: 'GetUserSites',
      apiKey: 'secret-key',
    });
    const [url] = fetcher.mock.calls[0]!;
    expect(url).toContain('/GetUserSites?');
    expect(url).toContain('apikey=secret-key');
  });

  it('appends params and url-encodes them', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: FetchInit) => ok({ d: [] }));
    await requestBing(fetcher, {
      baseUrl: BASE,
      method: 'GetQueryStats',
      apiKey: 'k',
      params: { siteUrl: 'https://example.com/', q: 'a b' },
    });
    const [url] = fetcher.mock.calls[0]!;
    expect(url).toContain('siteUrl=https%3A%2F%2Fexample.com%2F');
    expect(url).toContain('q=a+b');
  });

  it('drops undefined params rather than sending the literal string', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: FetchInit) => ok({ d: [] }));
    await requestBing(fetcher, {
      baseUrl: BASE,
      method: 'GetKeywordStats',
      apiKey: 'k',
      params: { q: 'seo', country: undefined },
    });
    const [url] = fetcher.mock.calls[0]!;
    expect(url).not.toContain('country');
    expect(url).not.toContain('undefined');
  });

  it('unwraps the d envelope for an array payload', async () => {
    const fetcher = async () => ok({ d: [{ Clicks: 3 }] });
    await expect(requestBing(fetcher, { baseUrl: BASE, method: 'M', apiKey: 'k' })).resolves.toEqual(
      [{ Clicks: 3 }],
    );
  });

  it('unwraps the d envelope for an object payload', async () => {
    const fetcher = async () => ok({ d: { Quota: 10 } });
    await expect(requestBing(fetcher, { baseUrl: BASE, method: 'M', apiKey: 'k' })).resolves.toEqual(
      { Quota: 10 },
    );
  });

  it('throws when the d envelope is absent, naming the method', async () => {
    const fetcher = async () => ok({ Clicks: 3 });
    await expect(
      requestBing(fetcher, { baseUrl: BASE, method: 'GetQueryStats', apiKey: 'k' }),
    ).rejects.toThrow(/GetQueryStats/);
  });

  it('throws BingApiError with status and body on non-2xx', async () => {
    const fetcher = async () => fail(429, 'quota exceeded');
    await expect(
      requestBing(fetcher, { baseUrl: BASE, method: 'M', apiKey: 'k' }),
    ).rejects.toMatchObject({ name: 'BingApiError', status: 429, body: 'quota exceeded' });
  });

  it('never puts the api key in the thrown message', async () => {
    const fetcher = async () => fail(401, 'unauthorized');
    const err = await requestBing(fetcher, {
      baseUrl: BASE,
      method: 'M',
      apiKey: 'super-secret',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BingApiError);
    expect((err as BingApiError).message).not.toContain('super-secret');
    expect((err as BingApiError).body).not.toContain('super-secret');
  });
});
