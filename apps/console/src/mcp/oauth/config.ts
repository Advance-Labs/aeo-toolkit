/**
 * Where the search server's OAuth authorization server lives, and what it signs with.
 *
 * WHY IT EXISTS. The search tools need a Google credential per caller. A browser gets one from the
 * Connect Google flow (`/api/auth/google`), keyed by the `aeo_session` cookie. An MCP client such as
 * Claude Code has no cookie, so it could only work by pasting a raw Google access token into an
 * `Authorization` header, and that token dies within the hour. This authorization server lets the
 * client run the standard MCP OAuth 2.1 login instead: the user approves on Google's own consent
 * screen, and the client receives an `aeo_at_` token that NAMES the stored Google connection rather
 * than containing it. The tools then resolve and refresh that user's Google token as usual.
 *
 * PATH-SCOPED ON PURPOSE. The issuer is `${origin}/api/mcp/oauth`, not the bare origin, so its
 * RFC 8414 document lives at `/.well-known/oauth-authorization-server/api/mcp/oauth` and the ROOT
 * `.well-known` documents stay 404. The ai-visibility and backlink servers on this origin take their
 * keys as tool arguments and need no login; a root document would drag them into an OAuth flow for
 * nothing. See `configuredAuthorizationServers` in `../shared.ts` for what broke the last time a root
 * document advertised endpoints.
 *
 * STATELESS. Client registrations, codes and tokens are sealed (see `./seal.ts`) with
 * `OAUTH_STATE_SECRET`, so there is no table to migrate and no row to expire. The cost: a single
 * token cannot be revoked. Disconnecting Google (deleting the stored row) disables every token for
 * that user, and rotating the secret disables every token for everyone.
 *
 * No secret, no server: every OAuth route 404s and the MCP route keeps its BYOK-only behaviour.
 */

/** Issuer path under this origin. */
export const OAUTH_ISSUER_PATH = '/api/mcp/oauth';

/**
 * Carries a sealed `/authorize` request across the Google Connect round-trip. Scoped like the other
 * OAuth cookies (`authCookieOptions`), so it survives a Google callback that lands on a sibling host.
 */
export const MCP_AUTHZ_COOKIE = 'aeo_mcp_authz';

/** The one scope this server grants: read the caller's Search Console, GA4 and Bing data. */
export const SEARCH_SCOPE = 'search:read';

/**
 * The MCP resources this issuer mints tokens for: the search server and its `ga-gsc` compatibility
 * alias. Same tools behind both, so a token for one is honoured by the other.
 */
export const PROTECTED_RESOURCE_PATHS = ['/api/mcp/search/mcp', '/api/mcp/ga-gsc/mcp'] as const;
export type ProtectedResourcePath = (typeof PROTECTED_RESOURCE_PATHS)[number];

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/** The sealing secret, or `null` when the authorization server is switched off. */
export function oauthSecret(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.OAUTH_STATE_SECRET?.trim();
  return value !== undefined && value.length > 0 ? value : null;
}

/**
 * The origin a request arrived on. Used instead of `MCP_PUBLIC_URL` so the issuer, the resource and
 * the redirect all name the host the client actually talked to, previews included.
 */
export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function issuerFor(origin: string): string {
  return `${origin}${OAUTH_ISSUER_PATH}`;
}

export function resourceFor(origin: string, path: ProtectedResourcePath): string {
  return `${origin}${path}`;
}

/** RFC 9728 §3.1: the metadata URL is the resource path appended to the well-known prefix. */
export function resourceMetadataUrl(origin: string, path: ProtectedResourcePath): string {
  return `${origin}/.well-known/oauth-protected-resource${path}`;
}

/** Is `url` (an RFC 8707 `resource` value) one of the MCP resources on this origin? */
export function isProtectedResource(origin: string, url: string): boolean {
  const wanted = trimTrailingSlash(url);
  return PROTECTED_RESOURCE_PATHS.some((path) => resourceFor(origin, path) === wanted);
}
