/**
 * `/.well-known/oauth-protected-resource` — RFC 9728 protected-resource metadata.
 *
 * Tells Claude.ai (and other MCP clients) which authorization server guards this
 * deployment's MCP endpoints so the remote connector can auto-register. Served via
 * `@advance-labs/mcp-core#wellKnownProtectedResource`, with URLs based on `MCP_PUBLIC_URL`
 * (resolved in `@/mcp/shared`). One document covers all three MCP servers since
 * they share this origin.
 *
 * Node runtime for parity with the MCP routes; the document itself is pure.
 */
import { wellKnownProtectedResource } from '@advance-labs/mcp-core';

import { mcpPublicUrl } from '@/mcp/shared.js';

export const runtime = 'nodejs';

/** Optional dedicated OAuth issuer; defaults to this origin when unset. */
function authorizationServers(origin: string): string[] {
  const configured = process.env.OAUTH_AUTHORIZATION_SERVERS?.trim();
  if (configured && configured.length > 0) {
    return configured
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  const issuer = process.env.OAUTH_ISSUER?.trim();
  return [issuer && issuer.length > 0 ? issuer : origin];
}

export function GET(): Response {
  const origin = mcpPublicUrl();
  const metadata = wellKnownProtectedResource({
    resource: origin,
    authorizationServers: authorizationServers(origin),
    resourceDocumentation: `${origin}/`,
  });
  return Response.json(metadata);
}
