import { describe, expect, it } from 'vitest';
import { bearerToken, routeFor } from './http-util.js';

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

describe('routeFor', () => {
  it('maps the well-known discovery paths', () => {
    expect(routeFor('GET', '/.well-known/oauth-authorization-server')).toBe('well-known-oauth');
    expect(routeFor('GET', '/.well-known/oauth-protected-resource')).toBe(
      'well-known-protected-resource',
    );
  });

  it('maps mcp, callback, health, and unknown routes', () => {
    expect(routeFor('POST', '/mcp')).toBe('mcp');
    expect(routeFor('POST', '/')).toBe('mcp');
    expect(routeFor('GET', '/oauth/callback')).toBe('oauth-callback');
    expect(routeFor('GET', '/health')).toBe('health');
    expect(routeFor('GET', '/nope')).toBe('not-found');
  });

  it('ignores trailing slashes', () => {
    expect(routeFor('GET', '/health/')).toBe('health');
  });
});
