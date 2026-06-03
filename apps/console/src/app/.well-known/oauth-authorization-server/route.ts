/**
 * `/.well-known/oauth-authorization-server` — RFC 8414 authorization-server
 * metadata, shaped for OAuth 2.1 + PKCE.
 *
 * Served via `@aeo/mcp-core#wellKnownOAuthMetadata` with the issuer based on
 * `OAUTH_ISSUER` (falling back to `MCP_PUBLIC_URL`, resolved in `@/mcp/shared`).
 * Claude.ai fetches this to learn where to start the authorization flow for the
 * deployment's MCP endpoints.
 *
 * Node runtime for parity with the MCP routes; the document itself is pure.
 */
import { wellKnownOAuthMetadata } from '@aeo/mcp-core';

import { mcpPublicUrl } from '@/mcp/shared.js';

export const runtime = 'nodejs';

export function GET(): Response {
  const origin = mcpPublicUrl();
  const issuer = process.env.OAUTH_ISSUER?.trim() || origin;
  const metadata = wellKnownOAuthMetadata({ issuer });
  return Response.json(metadata);
}
