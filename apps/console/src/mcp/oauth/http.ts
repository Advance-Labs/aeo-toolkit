/**
 * Response shapes shared by the `/api/mcp/oauth/*` routes. RFC 6749 §5.2 error bodies, `no-store` on
 * anything carrying a credential, and redirects that stamp parameters onto a client's redirect URI.
 */

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export function oauthJson(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function oauthError(status: number, error: string, description: string): Response {
  return oauthJson({ error, error_description: description }, status);
}

/**
 * A plain-text 400 for failures that must NOT redirect: an unknown client or an unregistered
 * redirect URI means there is no trustworthy place to send the browser (RFC 6749 §4.1.2.1).
 */
export function plainError(message: string): Response {
  return new Response(message, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** `uri` with each defined param set on its query string. */
export function withParams(uri: string, params: Record<string, string | undefined>): string {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}
