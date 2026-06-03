/**
 * `.well-known` OAuth discovery documents for Claude.ai connector auto-registration.
 *
 * Pure builders over the server's public URL + Google's OAuth endpoints. Claude.ai
 * fetches these two documents to learn (a) where to send the user to authorize and
 * (b) which authorization server guards this MCP resource. We point the AS metadata
 * at Google's real endpoints so the consent flow runs against Google directly.
 */
import {
  wellKnownOAuthMetadata,
  wellKnownProtectedResource,
  type OAuthAuthorizationServerMetadata,
  type OAuthProtectedResourceMetadata,
} from '@aeo/mcp-core';
import { DEFAULT_READONLY_SCOPES } from '@aeo/google-api';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** Build the authorization-server discovery doc pointing at Google's OAuth endpoints. */
export function authServerMetadata(publicUrl: string): OAuthAuthorizationServerMetadata {
  return wellKnownOAuthMetadata({
    issuer: publicUrl,
    authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
    tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
    // Dynamic client registration is not offered (Google uses pre-registered clients);
    // the registration endpoint resolves under our origin and returns a clear 501.
    registrationEndpoint: `${trimSlash(publicUrl)}/register`,
    scopesSupported: [...DEFAULT_READONLY_SCOPES],
  });
}

/** Build the protected-resource discovery doc for this MCP endpoint. */
export function protectedResourceMetadata(publicUrl: string): OAuthProtectedResourceMetadata {
  const url = trimSlash(publicUrl);
  return wellKnownProtectedResource({
    resource: url,
    authorizationServers: [url],
    scopesSupported: [...DEFAULT_READONLY_SCOPES],
    bearerMethodsSupported: ['header'],
    resourceDocumentation: `${url}/`,
  });
}

function trimSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
