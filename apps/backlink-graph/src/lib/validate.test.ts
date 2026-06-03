import { describe, expect, it } from 'vitest';
import { validateGraphRequest } from './validate.js';

describe('validateGraphRequest', () => {
  it('accepts a bare hostname and normalizes to https', () => {
    const result = validateGraphRequest({ url: 'example.com' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://example.com/');
  });

  it('preserves an explicit http scheme', () => {
    const result = validateGraphRequest({ url: 'http://example.com/path' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://example.com/path');
  });

  it('preserves an explicit https scheme with a path', () => {
    const result = validateGraphRequest({ url: 'https://acme.io/blog/post' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://acme.io/blog/post');
  });

  it('rejects a non-object body', () => {
    const result = validateGraphRequest('https://example.com');
    expect(result.ok).toBe(false);
  });

  it('rejects a null body', () => {
    const result = validateGraphRequest(null);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing url field', () => {
    const result = validateGraphRequest({});
    expect(result.ok).toBe(false);
  });

  it('rejects a non-string url', () => {
    const result = validateGraphRequest({ url: 42 });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty / whitespace url', () => {
    const result = validateGraphRequest({ url: '   ' });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-http(s) protocol without corrupting it', () => {
    const result = validateGraphRequest({ url: 'ftp://example.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/http/i);
  });
});
