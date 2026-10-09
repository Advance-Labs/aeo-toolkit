import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './AuditInputCard';

describe('normalizeUrl', () => {
  it('returns empty string for blank input', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
  });

  it('passes through https:// URL', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('passes through http:// URL', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('adds https:// to bare domain', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('trims spaces first', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
  });
});
