import { afterEach, describe, expect, it } from 'vitest';
import { AuditError } from './audit-errors.js';
import {
  configuredDefaultMaxPages,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CEILING,
  normalizeUrl,
  parseAuditRequest,
} from './audit-validate.js';

afterEach(() => {
  delete process.env.AUDIT_MAX_PAGES;
});

describe('normalizeUrl', () => {
  it('prepends https when the scheme is missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('preserves an explicit http scheme', () => {
    expect(normalizeUrl('http://example.com/path')).toBe('http://example.com/path');
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow(AuditError);
  });
});

describe('parseAuditRequest', () => {
  it('defaults maxPages to 50 when omitted', () => {
    const req = parseAuditRequest({ url: 'example.com' });
    expect(req.url).toBe('https://example.com/');
    expect(req.maxPages).toBe(DEFAULT_MAX_PAGES);
  });

  it('clamps maxPages to the ceiling', () => {
    const req = parseAuditRequest({ url: 'example.com', maxPages: 9999 });
    expect(req.maxPages).toBe(MAX_PAGES_CEILING);
  });

  it('rejects a missing url', () => {
    expect(() => parseAuditRequest({})).toThrow(AuditError);
  });

  it('rejects a non-number maxPages', () => {
    expect(() => parseAuditRequest({ url: 'example.com', maxPages: 'lots' })).toThrow(AuditError);
  });

  it('rejects a non-object payload', () => {
    expect(() => parseAuditRequest('https://example.com')).toThrow(AuditError);
  });
});

describe('configuredDefaultMaxPages', () => {
  it('uses AUDIT_MAX_PAGES when valid', () => {
    process.env.AUDIT_MAX_PAGES = '25';
    expect(configuredDefaultMaxPages()).toBe(25);
  });

  it('falls back to the default for invalid env values', () => {
    process.env.AUDIT_MAX_PAGES = 'not-a-number';
    expect(configuredDefaultMaxPages()).toBe(DEFAULT_MAX_PAGES);
  });

  it('clamps an over-large env value to the ceiling', () => {
    process.env.AUDIT_MAX_PAGES = '500';
    expect(configuredDefaultMaxPages()).toBe(MAX_PAGES_CEILING);
  });
});
