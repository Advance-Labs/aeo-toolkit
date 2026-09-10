/**
 * Guards the rule that a discovery document must never name an authorization
 * server this app does not implement.
 *
 * The regression these pin: `OAUTH_ISSUER` was unset in production, both documents
 * fell back to this origin, and the authorization-server document advertised
 * `${origin}/register` for Dynamic Client Registration. `/register`, `/authorize`
 * and `/token` do not exist here, so every discovering MCP client POSTed to a
 * Next.js HTML 404 and reported "Dynamic Client Registration rejected (HTTP 404)".
 *
 * Serving 404 is the correct answer, not a degraded one: it is what makes a client
 * skip OAuth and connect with the BYOK headers these servers actually read.
 */
import { describe, expect, it } from 'vitest';

import { configuredAuthorizationServers } from '@/mcp/shared.js';

const ORIGIN = 'https://aeo.advancelabs.dev';

describe('configuredAuthorizationServers', () => {
  it('reports none when nothing is configured', () => {
    expect(configuredAuthorizationServers(ORIGIN, {})).toBeNull();
  });

  it('refuses to name this origin as its own authorization server', () => {
    // The production failure, exactly: an issuer equal to the resource origin.
    expect(configuredAuthorizationServers(ORIGIN, { OAUTH_ISSUER: ORIGIN })).toBeNull();
    expect(
      configuredAuthorizationServers(ORIGIN, { OAUTH_AUTHORIZATION_SERVERS: ORIGIN }),
    ).toBeNull();
  });

  it('ignores a trailing slash when deciding whether an issuer is really external', () => {
    // `https://x/` and `https://x` are the same server; a slash must not smuggle
    // the self-reference back past the check.
    expect(configuredAuthorizationServers(ORIGIN, { OAUTH_ISSUER: `${ORIGIN}/` })).toBeNull();
  });

  it('returns a genuinely external issuer', () => {
    expect(configuredAuthorizationServers(ORIGIN, { OAUTH_ISSUER: 'https://auth.example.com' })
    ).toEqual(['https://auth.example.com']);
  });

  it('keeps only the external entries from a mixed list', () => {
    expect(
      configuredAuthorizationServers(ORIGIN, {
        OAUTH_AUTHORIZATION_SERVERS: `${ORIGIN}, https://auth.example.com`,
      }),
    ).toEqual(['https://auth.example.com']);
  });
});

describe('the .well-known routes', () => {
  it('404 both documents when no external issuer is configured', async () => {
    // Import after clearing, since the routes read process.env at request time.
    delete process.env.OAUTH_ISSUER;
    delete process.env.OAUTH_AUTHORIZATION_SERVERS;

    const [resource, server] = await Promise.all([
      import('./oauth-protected-resource/route.js'),
      import('./oauth-authorization-server/route.js'),
    ]);

    expect(resource.GET().status).toBe(404);
    expect(server.GET().status).toBe(404);
  });
});
