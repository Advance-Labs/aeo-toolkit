/**
 * `/.well-known/oauth-protected-resource` — RFC 9728 protected-resource metadata.
 *
 * Served ONLY when an external authorization server is configured
 * (`OAUTH_AUTHORIZATION_SERVERS`, or `OAUTH_ISSUER`). Otherwise this returns 404,
 * because there is nothing true to say: every MCP server on this origin is BYOK,
 * and this app implements no OAuth endpoints of its own. See
 * `configuredAuthorizationServers` for why advertising this origin as its own
 * authorization server broke every discovering client.
 *
 * A 404 here is not a degraded state. It is the signal that makes an MCP client
 * skip the OAuth flow and connect with the headers this server actually reads.
 *
 * Node runtime for parity with the MCP routes; the document itself is pure.
 */
import { wellKnownProtectedResource } from '@advance-labs/mcp-core';

import { configuredAuthorizationServers, mcpPublicUrl } from '@/mcp/shared.js';

export const runtime = 'nodejs';

export function GET(): Response {
  const origin = mcpPublicUrl();
  const authorizationServers = configuredAuthorizationServers(origin);
  if (authorizationServers === null) {
    return new Response('Not found', { status: 404 });
  }

  const metadata = wellKnownProtectedResource({
    resource: origin,
    authorizationServers,
    resourceDocumentation: `${origin}/`,
  });
  return Response.json(metadata);
}
