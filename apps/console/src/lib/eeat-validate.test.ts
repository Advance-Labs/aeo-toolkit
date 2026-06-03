import { describe, expect, it } from 'vitest';
import { validateAuditBody } from './eeat-validate.js';

describe('validateAuditBody', () => {
  it('accepts a bare hostname and normalizes to https', () => {
    const result = validateAuditBody({ url: 'example.com' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://example.com/');
  });

  it('preserves an explicit http scheme', () => {
    const result = validateAuditBody({ url: 'http://example.com/path' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://example.com/path');
  });

  it('rejects a non-object body', () => {
    const result = validateAuditBody('https://example.com');
    expect(result.ok).toBe(false);
  });

  it('rejects a missing url field', () => {
    const result = validateAuditBody({});
    expect(result.ok).toBe(false);
  });

  it('rejects an empty url', () => {
    const result = validateAuditBody({ url: '   ' });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-http(s) protocol', () => {
    const result = validateAuditBody({ url: 'ftp://example.com' });
    expect(result.ok).toBe(false);
  });
});
