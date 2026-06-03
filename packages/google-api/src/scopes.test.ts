import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READONLY_SCOPES,
  GA4_ADMIN_READONLY_SCOPE,
  GA4_READONLY_SCOPE,
  GSC_READONLY_SCOPE,
  GSC_SITEMAPS_SCOPE,
} from './scopes.js';

describe('scope constants', () => {
  it('exposes the expected Google OAuth scope URLs', () => {
    expect(GA4_READONLY_SCOPE).toBe('https://www.googleapis.com/auth/analytics.readonly');
    expect(GSC_READONLY_SCOPE).toBe('https://www.googleapis.com/auth/webmasters.readonly');
    expect(GSC_SITEMAPS_SCOPE).toBe('https://www.googleapis.com/auth/webmasters');
  });

  it('aliases the GA4 admin read scope to analytics.readonly (the surface that covers it)', () => {
    expect(GA4_ADMIN_READONLY_SCOPE).toBe(GA4_READONLY_SCOPE);
  });

  it('keeps the default scope set read-only — the write scope is opt-in', () => {
    expect(DEFAULT_READONLY_SCOPES).toEqual([GA4_READONLY_SCOPE, GSC_READONLY_SCOPE]);
    expect(DEFAULT_READONLY_SCOPES).not.toContain(GSC_SITEMAPS_SCOPE);
  });
});
