import { describe, expect, it } from 'vitest';

import { oauthAuthorizationServerMetadata, oauthProtectedResourceMetadata } from './http.js';

describe('oauth discovery documents', () => {
  it('builds authorization-server metadata from env', () => {
    const meta = oauthAuthorizationServerMetadata({
      MCP_PUBLIC_URL: 'https://mcp.test.com/',
      OAUTH_ISSUER: 'https://auth.test.com',
    });
    expect(meta.issuer).toBe('https://auth.test.com');
    expect(meta.authorization_endpoint).toBe('https://auth.test.com/authorize');
    expect(meta.code_challenge_methods_supported).toContain('S256');
  });

  it('falls back to the resource URL as issuer when none is set', () => {
    const meta = oauthAuthorizationServerMetadata({ MCP_PUBLIC_URL: 'https://mcp.test.com' });
    expect(meta.issuer).toBe('https://mcp.test.com');
  });

  it('builds protected-resource metadata pointing at the auth server', () => {
    const meta = oauthProtectedResourceMetadata({
      MCP_PUBLIC_URL: 'https://mcp.test.com',
      OAUTH_AUTHORIZATION_SERVERS: 'https://auth.test.com, https://auth2.test.com',
    });
    expect(meta.resource).toBe('https://mcp.test.com');
    expect(meta.authorization_servers).toEqual(['https://auth.test.com', 'https://auth2.test.com']);
  });
});
