/**
 * Pure HTTP helper: bearer-token extraction. Kept transport-agnostic and
 * side-effect free so it unit-tests without a server.
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
