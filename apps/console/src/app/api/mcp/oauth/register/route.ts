/**
 * POST /api/mcp/oauth/register: RFC 7591 Dynamic Client Registration for the search MCP server.
 *
 * Open by design (MCP clients register themselves on first connect). What an open registry allows is
 * bounded by `isAllowedRedirectUri`. Every client is public (`token_endpoint_auth_method: none`):
 * whatever a client asks for, it gets no secret, and PKCE is what protects its codes. The returned
 * `client_id` is the registration itself, sealed, so nothing is stored.
 */
import { oauthSecret } from '@/mcp/oauth/config.js';
import { registerClient } from '@/mcp/oauth/grants.js';
import { oauthError, oauthJson } from '@/mcp/oauth/http.js';
import { isAllowedRedirectUri } from '@/mcp/oauth/redirect-policy.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REDIRECT_URIS = 10;
const MAX_URI_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;

export async function POST(request: Request): Promise<Response> {
  const secret = oauthSecret();
  if (secret === null) return new Response('Not found', { status: 404 });

  let meta: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error('not an object');
    meta = body as Record<string, unknown>;
  } catch {
    return oauthError(400, 'invalid_client_metadata', 'The body must be a JSON object');
  }

  const uris = meta.redirect_uris;
  if (
    !Array.isArray(uris) ||
    uris.length === 0 ||
    uris.length > MAX_REDIRECT_URIS ||
    !uris.every((u): u is string => typeof u === 'string' && u.length > 0 && u.length <= MAX_URI_LENGTH)
  ) {
    return oauthError(400, 'invalid_redirect_uri', 'redirect_uris must be a non-empty array of URLs');
  }
  const refused = uris.find((uri) => !isAllowedRedirectUri(uri));
  if (refused !== undefined) {
    return oauthError(400, 'invalid_redirect_uri', `Redirect URI not allowed: ${refused}`);
  }

  const name =
    typeof meta.client_name === 'string' && meta.client_name.trim().length > 0
      ? meta.client_name.trim().slice(0, MAX_NAME_LENGTH)
      : undefined;
  const clientId = registerClient({ redirectUris: uris, ...(name !== undefined ? { name } : {}) }, secret);

  return oauthJson(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: uris,
      ...(name !== undefined ? { client_name: name } : {}),
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    201,
  );
}
