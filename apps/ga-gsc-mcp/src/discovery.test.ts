import { describe, expect, it } from 'vitest';
import { authServerMetadata, protectedResourceMetadata } from './discovery.js';

describe('authServerMetadata', () => {
  it('points the AS metadata at Google endpoints and the server issuer', () => {
    const meta = authServerMetadata('https://mcp.example.com/');
    expect(meta.issuer).toBe('https://mcp.example.com');
    expect(meta.authorization_endpoint).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(meta.token_endpoint).toBe('https://oauth2.googleapis.com/token');
    expect(meta.code_challenge_methods_supported).toContain('S256');
    expect(meta.scopes_supported.some((s) => s.includes('analytics'))).toBe(true);
  });
});

describe('protectedResourceMetadata', () => {
  it('declares this server as the resource and its own AS', () => {
    const meta = protectedResourceMetadata('https://mcp.example.com');
    expect(meta.resource).toBe('https://mcp.example.com');
    expect(meta.authorization_servers).toEqual(['https://mcp.example.com']);
    expect(meta.bearer_methods_supported).toEqual(['header']);
  });
});
