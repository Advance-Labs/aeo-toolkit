/**
 * OAuth 2.1 `.well-known` discovery document builders.
 *
 * Pure functions returning the JSON objects Claude.ai (and other MCP clients)
 * fetch to auto-register against a remote MCP server's authorization layer:
 *
 *  - `/.well-known/oauth-authorization-server`  (RFC 8414, AS metadata)
 *  - `/.well-known/oauth-protected-resource`    (RFC 9728, protected-resource metadata)
 *
 * No I/O: callers serve the returned objects from a route handler. Trailing
 * slashes on `issuer` are normalised so concatenated endpoint URLs stay clean.
 */

/** Strip a single trailing slash so `${issuer}/authorize` never doubles up. */
function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export interface OAuthMetadataConfig {
  /** The authorization server issuer URL, e.g. `https://mcp.example.com`. */
  issuer: string;
  /** Override the authorization endpoint (defaults to `${issuer}/authorize`). */
  authorizationEndpoint?: string;
  /** Override the token endpoint (defaults to `${issuer}/token`). */
  tokenEndpoint?: string;
  /** Override the dynamic client registration endpoint (defaults to `${issuer}/register`). */
  registrationEndpoint?: string;
  /** OAuth scopes the server supports. Defaults to `['openid']`. */
  scopesSupported?: string[];
  /**
   * PKCE code-challenge methods. OAuth 2.1 requires PKCE; defaults to `['S256']`.
   * `plain` is intentionally omitted by default per OAuth 2.1 guidance.
   */
  codeChallengeMethodsSupported?: string[];
  /** Grant types offered. Defaults to authorization_code + refresh_token. */
  grantTypesSupported?: string[];
  /** Response types offered. Defaults to `['code']` (OAuth 2.1 drops the implicit flow). */
  responseTypesSupported?: string[];
  /** Token endpoint client auth methods. Defaults to public-client friendly set. */
  tokenEndpointAuthMethodsSupported?: string[];
}

/** RFC 8414 authorization-server metadata, shaped for OAuth 2.1 + PKCE. */
export interface OAuthAuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

/**
 * Build the `/.well-known/oauth-authorization-server` discovery document.
 * Defaults are OAuth 2.1-compliant (PKCE S256, no implicit flow).
 */
export function wellKnownOAuthMetadata(cfg: OAuthMetadataConfig): OAuthAuthorizationServerMetadata {
  const issuer = trimTrailingSlash(cfg.issuer);
  return {
    issuer,
    authorization_endpoint: cfg.authorizationEndpoint ?? `${issuer}/authorize`,
    token_endpoint: cfg.tokenEndpoint ?? `${issuer}/token`,
    registration_endpoint: cfg.registrationEndpoint ?? `${issuer}/register`,
    scopes_supported: cfg.scopesSupported ?? ['openid'],
    response_types_supported: cfg.responseTypesSupported ?? ['code'],
    grant_types_supported: cfg.grantTypesSupported ?? ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: cfg.codeChallengeMethodsSupported ?? ['S256'],
    token_endpoint_auth_methods_supported: cfg.tokenEndpointAuthMethodsSupported ?? [
      'none',
      'client_secret_post',
    ],
  };
}

export interface ProtectedResourceConfig {
  /** The protected resource (this MCP server) URL, e.g. `https://mcp.example.com`. */
  resource: string;
  /** Authorization server issuer URLs that can mint tokens for this resource. */
  authorizationServers: string[];
  /** Scopes a client may request to access this resource. Defaults to `['openid']`. */
  scopesSupported?: string[];
  /** Supported bearer-token presentation methods. Defaults to `['header']`. */
  bearerMethodsSupported?: string[];
  /** Optional human-facing documentation URL surfaced in the metadata. */
  resourceDocumentation?: string;
}

/** RFC 9728 protected-resource metadata. */
export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_documentation?: string;
}

/**
 * Build the `/.well-known/oauth-protected-resource` discovery document that tells
 * Claude.ai which authorization server(s) guard this MCP endpoint.
 */
export function wellKnownProtectedResource(
  cfg: ProtectedResourceConfig,
): OAuthProtectedResourceMetadata {
  const resource = trimTrailingSlash(cfg.resource);
  const metadata: OAuthProtectedResourceMetadata = {
    resource,
    authorization_servers: cfg.authorizationServers.map(trimTrailingSlash),
    scopes_supported: cfg.scopesSupported ?? ['openid'],
    bearer_methods_supported: cfg.bearerMethodsSupported ?? ['header'],
  };
  if (cfg.resourceDocumentation !== undefined) {
    metadata.resource_documentation = cfg.resourceDocumentation;
  }
  return metadata;
}
