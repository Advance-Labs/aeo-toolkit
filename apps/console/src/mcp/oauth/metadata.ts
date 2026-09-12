/**
 * The two discovery documents for the search server's authorization server, served from
 * path-scoped `.well-known` URLs (see `./config.ts` for why never the root ones).
 *
 * Both 404 when `OAUTH_STATE_SECRET` is unset. A document is only served when every endpoint it
 * names exists. The endpoints named here are the routes under `/api/mcp/oauth/`.
 */
import { wellKnownOAuthMetadata, wellKnownProtectedResource } from '@advance-labs/mcp-core';

import {
  issuerFor,
  oauthSecret,
  requestOrigin,
  resourceFor,
  SEARCH_SCOPE,
  type ProtectedResourcePath,
} from './config.js';

const notFound = (): Response => new Response('Not found', { status: 404 });

/** RFC 8414 metadata for the issuer at `${origin}/api/mcp/oauth`. */
export function authorizationServerMetadata(request: Request): Response {
  if (oauthSecret() === null) return notFound();
  const issuer = issuerFor(requestOrigin(request));
  return Response.json(
    wellKnownOAuthMetadata({
      issuer,
      authorizationEndpoint: `${issuer}/authorize`,
      tokenEndpoint: `${issuer}/token`,
      registrationEndpoint: `${issuer}/register`,
      scopesSupported: [SEARCH_SCOPE],
      tokenEndpointAuthMethodsSupported: ['none'],
    }),
  );
}

/** RFC 9728 metadata for one MCP resource, pointing at this origin's issuer. */
export function protectedResourceMetadata(request: Request, path: ProtectedResourcePath): Response {
  if (oauthSecret() === null) return notFound();
  const origin = requestOrigin(request);
  return Response.json(
    wellKnownProtectedResource({
      resource: resourceFor(origin, path),
      authorizationServers: [issuerFor(origin)],
      scopesSupported: [SEARCH_SCOPE],
      resourceDocumentation: `${origin}/mcp`,
    }),
  );
}
