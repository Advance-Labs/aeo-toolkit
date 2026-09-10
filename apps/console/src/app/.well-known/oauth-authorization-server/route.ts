/**
 * `/.well-known/oauth-authorization-server` — RFC 8414 authorization-server
 * metadata, shaped for OAuth 2.1 + PKCE.
 *
 * Served ONLY when `OAUTH_ISSUER` names an authorization server that is NOT this
 * origin. This app implements no `/authorize`, `/token` or `/register`, so a
 * document naming itself as the issuer advertises three endpoints that 404 — which
 * is exactly what it did, and what made clients fail Dynamic Client Registration
 * against a Next.js HTML 404 page.
 *
 * When the issuer IS external, that server publishes its own RFC 8414 document at
 * its own origin and clients read it directly; this route stays 404 in that case
 * too unless someone deliberately mirrors it here. Hence: metadata only for a
 * configured external issuer, 404 otherwise, never a self-referential document.
 *
 * Node runtime for parity with the MCP routes; the document itself is pure.
 */
import { wellKnownOAuthMetadata } from '@advance-labs/mcp-core';

import { configuredAuthorizationServers, mcpPublicUrl } from '@/mcp/shared.js';

export const runtime = 'nodejs';

export function GET(): Response {
  const origin = mcpPublicUrl();
  const issuers = configuredAuthorizationServers(origin);
  if (issuers === null || issuers[0] === undefined) {
    return new Response('Not found', { status: 404 });
  }

  const metadata = wellKnownOAuthMetadata({ issuer: issuers[0] });
  return Response.json(metadata);
}
