import { describe, expect, it } from 'vitest';
import { bearerToken } from './http-util.js';

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
