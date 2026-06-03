/**
 * Pure HTTP helpers for the hosted entry: bearer-token extraction and small URL
 * utilities. Kept transport-agnostic and side-effect free so they unit-test
 * without spinning up a server.
 */

/**
 * Extract a request-scoped BYOK bearer token from an `Authorization` header value.
 * Returns `null` when absent or not a Bearer scheme. The token is never logged by
 * callers — it is forwarded straight into the Google client.
 */
export function bearerToken(authorization: string | undefined | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) return null;
  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/** The set of routes the hosted server understands, for dispatch + testing. */
export type Route =
  | 'mcp'
  | 'well-known-oauth'
  | 'well-known-protected-resource'
  | 'oauth-callback'
  | 'authorize'
  | 'health'
  | 'not-found';

/** Map a request method + pathname to a {@link Route}. Pure; no I/O. */
export function routeFor(method: string, pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/.well-known/oauth-authorization-server') return 'well-known-oauth';
  if (path === '/.well-known/oauth-protected-resource') return 'well-known-protected-resource';
  if (path === '/oauth/callback') return 'oauth-callback';
  if (path === '/authorize') return 'authorize';
  if (path === '/health') return 'health';
  if (path === '/mcp' || path === '/') return 'mcp';
  return 'not-found';
}
