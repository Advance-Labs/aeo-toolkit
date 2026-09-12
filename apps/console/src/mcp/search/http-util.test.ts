import { describe, expect, it } from 'vitest';
import { bearerToken, bingApiKeyHeader } from './http-util.js';

describe('bearerToken', () => {
  it('extracts a Bearer token case-insensitively', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def');
    expect(bearerToken('bearer xyz')).toBe('xyz');
  });

  it('returns null for missing or non-bearer headers', () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer   ')).toBeNull();
  });
});

describe('bingApiKeyHeader', () => {
  it('returns the header value when present', () => {
    const headers = new Headers({ 'x-bing-api-key': 'abc123' });
    expect(bingApiKeyHeader(headers)).toBe('abc123');
  });

  it('returns null when the header is absent', () => {
    const headers = new Headers();
    expect(bingApiKeyHeader(headers)).toBeNull();
  });

  it('returns null for a whitespace-only header', () => {
    const headers = new Headers({ 'x-bing-api-key': '   ' });
    expect(bingApiKeyHeader(headers)).toBeNull();
  });
});
