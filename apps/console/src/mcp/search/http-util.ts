/**
 * Pure HTTP helpers: extraction of the two request-scoped BYOK credentials this
 * server accepts — the Google `Authorization` bearer token and the Bing
 * `x-bing-api-key` header. Kept transport-agnostic and side-effect free so they
 * unit-test without a server.
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

/** Read the request-scoped Bing API key. Never logged, never persisted. */
export function bingApiKeyHeader(headers: Headers): string | null {
  const raw = headers.get('x-bing-api-key');
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
