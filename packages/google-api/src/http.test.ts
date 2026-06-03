import { describe, expect, it } from 'vitest';
import {
  asNumber,
  asRecord,
  asRecordArray,
  asString,
  GoogleApiError,
  requestForm,
  requestJson,
} from './http.js';
import { errorFetcher, jsonFetcher } from './test-helpers.js';

describe('requestJson', () => {
  it('attaches the bearer token, JSON-encodes the body, and returns parsed JSON', async () => {
    const mock = jsonFetcher({ ok: true });
    const result = await requestJson(mock.fetcher, 'https://api.test/x', {
      method: 'POST',
      accessToken: 'abc',
      body: { hello: 'world' },
    });

    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    expect(call.init?.headers?.['Authorization']).toBe('Bearer abc');
    expect(call.init?.headers?.['Content-Type']).toBe('application/json');
    expect(call.init?.body).toBe('{"hello":"world"}');
    expect(result).toEqual({ ok: true });
  });

  it('defaults to GET when there is no body', async () => {
    const mock = jsonFetcher({});
    await requestJson(mock.fetcher, 'https://api.test/y', { accessToken: 't' });
    expect(mock.calls[0]?.init?.method).toBe('GET');
  });

  it('throws GoogleApiError carrying status and body on non-2xx', async () => {
    const mock = errorFetcher(500, 'boom');
    await expect(
      requestJson(mock.fetcher, 'https://api.test/z', { accessToken: 't' }),
    ).rejects.toMatchObject({ status: 500, body: 'boom' });
  });
});

describe('requestForm', () => {
  it('sends a url-encoded body and the form content-type', async () => {
    const mock = jsonFetcher({ token: 1 });
    const form = new URLSearchParams({ a: '1', b: '2' });
    await requestForm(mock.fetcher, 'https://api.test/token', form);

    const call = mock.calls[0];
    expect(call?.init?.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(call?.init?.body).toBe('a=1&b=2');
  });

  it('throws GoogleApiError on non-2xx', async () => {
    const mock = errorFetcher(400, 'invalid');
    await expect(
      requestForm(mock.fetcher, 'https://api.test/token', new URLSearchParams()),
    ).rejects.toBeInstanceOf(GoogleApiError);
  });
});

describe('narrowing helpers', () => {
  it('asRecord returns {} for non-records', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord([1, 2])).toEqual({});
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it('asRecordArray keeps only object items', () => {
    expect(asRecordArray([{ a: 1 }, 2, null, [3]])).toEqual([{ a: 1 }]);
    expect(asRecordArray('nope')).toEqual([]);
  });

  it('asNumber coerces numeric strings and rejects junk', () => {
    expect(asNumber(5)).toBe(5);
    expect(asNumber('3.5')).toBe(3.5);
    expect(asNumber('abc')).toBe(0);
    expect(asNumber(undefined)).toBe(0);
  });

  it('asString returns strings or empty', () => {
    expect(asString('hi')).toBe('hi');
    expect(asString(42)).toBe('');
  });
});
