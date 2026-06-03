import { describe, expect, it } from 'vitest';
import { wellKnownOAuthMetadata, wellKnownProtectedResource } from './oauth.js';

describe('wellKnownOAuthMetadata', () => {
  it('produces OAuth 2.1-compliant defaults derived from the issuer', () => {
    const meta = wellKnownOAuthMetadata({ issuer: 'https://mcp.example.com' });

    expect(meta.issuer).toBe('https://mcp.example.com');
    expect(meta.authorization_endpoint).toBe('https://mcp.example.com/authorize');
    expect(meta.token_endpoint).toBe('https://mcp.example.com/token');
    expect(meta.registration_endpoint).toBe('https://mcp.example.com/register');
    // OAuth 2.1: PKCE required, no implicit flow.
    expect(meta.code_challenge_methods_supported).toEqual(['S256']);
    expect(meta.response_types_supported).toEqual(['code']);
    expect(meta.grant_types_supported).toContain('authorization_code');
    expect(meta.grant_types_supported).toContain('refresh_token');
  });

  it('normalises a trailing slash on the issuer so endpoints do not double up', () => {
    const meta = wellKnownOAuthMetadata({ issuer: 'https://mcp.example.com/' });
    expect(meta.issuer).toBe('https://mcp.example.com');
    expect(meta.authorization_endpoint).toBe('https://mcp.example.com/authorize');
  });

  it('honours explicit endpoint and scope overrides', () => {
    const meta = wellKnownOAuthMetadata({
      issuer: 'https://auth.example.com',
      authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
      tokenEndpoint: 'https://auth.example.com/oauth2/token',
      scopesSupported: ['openid', 'profile', 'mcp:tools'],
      codeChallengeMethodsSupported: ['S256', 'plain'],
    });
    expect(meta.authorization_endpoint).toBe('https://auth.example.com/oauth2/authorize');
    expect(meta.token_endpoint).toBe('https://auth.example.com/oauth2/token');
    expect(meta.scopes_supported).toEqual(['openid', 'profile', 'mcp:tools']);
    expect(meta.code_challenge_methods_supported).toEqual(['S256', 'plain']);
  });
});

describe('wellKnownProtectedResource', () => {
  it('builds protected-resource metadata pointing at its authorization servers', () => {
    const meta = wellKnownProtectedResource({
      resource: 'https://mcp.example.com',
      authorizationServers: ['https://auth.example.com'],
    });
    expect(meta.resource).toBe('https://mcp.example.com');
    expect(meta.authorization_servers).toEqual(['https://auth.example.com']);
    expect(meta.scopes_supported).toEqual(['openid']);
    expect(meta.bearer_methods_supported).toEqual(['header']);
    // Optional field omitted when not provided.
    expect(meta.resource_documentation).toBeUndefined();
  });

  it('trims trailing slashes on resource and authorization servers', () => {
    const meta = wellKnownProtectedResource({
      resource: 'https://mcp.example.com/',
      authorizationServers: ['https://auth.example.com/', 'https://alt.example.com/'],
    });
    expect(meta.resource).toBe('https://mcp.example.com');
    expect(meta.authorization_servers).toEqual([
      'https://auth.example.com',
      'https://alt.example.com',
    ]);
  });

  it('includes documentation when provided', () => {
    const meta = wellKnownProtectedResource({
      resource: 'https://mcp.example.com',
      authorizationServers: ['https://auth.example.com'],
      resourceDocumentation: 'https://docs.example.com/mcp',
    });
    expect(meta.resource_documentation).toBe('https://docs.example.com/mcp');
  });
});
