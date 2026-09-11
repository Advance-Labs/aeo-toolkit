/**
 * GET /api/mcp/oauth/authorize: start an MCP client's login.
 *
 * Validates the request, seals it into a short-lived cookie, and sends the browser through the
 * existing Connect Google flow (`/api/auth/google`), which returns to `/api/mcp/oauth/complete`.
 * There is no consent page of our own: Google's consent screen (always shown, `prompt=consent`) IS
 * the approval, and `isAllowedRedirectUri` limits where the resulting code can go.
 *
 * Order matters (RFC 6749 §4.1.2.1): until the client and redirect URI check out there is nowhere
 * safe to redirect, so those failures are a plain 400. After that, errors go back to the client.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { authCookieOptions } from '@/lib/oauth-return';
import {
  isProtectedResource,
  MCP_AUTHZ_COOKIE,
  OAUTH_ISSUER_PATH,
  oauthSecret,
  requestOrigin,
} from '@/mcp/oauth/config.js';
import { clientKey, readClient, REQUEST_TTL_SECONDS, sealPending } from '@/mcp/oauth/grants.js';
import { plainError, withParams } from '@/mcp/oauth/http.js';
import { redirectUriMatches } from '@/mcp/oauth/redirect-policy.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest): Response {
  const secret = oauthSecret();
  if (secret === null) return new Response('Not found', { status: 404 });

  const q = request.nextUrl.searchParams;
  const clientId = q.get('client_id');
  const client = readClient(clientId, secret);
  if (clientId === null || client === null) {
    return plainError('Unknown client. Remove and re-add the server in your MCP client, then retry.');
  }

  const only = client.redirectUris.length === 1 ? client.redirectUris[0] : undefined;
  const redirectUri = q.get('redirect_uri') ?? only;
  if (redirectUri === undefined || !client.redirectUris.some((r) => redirectUriMatches(r, redirectUri))) {
    return plainError('redirect_uri is not registered for this client.');
  }

  const state = q.get('state') ?? undefined;
  const fail = (error: string, description: string): Response =>
    NextResponse.redirect(withParams(redirectUri, { error, error_description: description, state }));

  if (q.get('response_type') !== 'code') {
    return fail('unsupported_response_type', 'Only response_type=code is supported');
  }
  const challenge = q.get('code_challenge');
  if (challenge === null || q.get('code_challenge_method') !== 'S256') {
    return fail('invalid_request', 'PKCE is required, with code_challenge_method=S256');
  }
  const origin = requestOrigin(request);
  const resource = q.get('resource') ?? undefined;
  if (resource !== undefined && !isProtectedResource(origin, resource)) {
    return fail('invalid_target', 'This server only issues tokens for its own search MCP endpoint');
  }

  const pending = sealPending(
    {
      cid: clientKey(clientId),
      redirectUri,
      challenge,
      ...(state !== undefined ? { state } : {}),
      ...(resource !== undefined ? { resource } : {}),
    },
    secret,
  );

  const google = new URL('/api/auth/google', origin);
  google.searchParams.set('return_to', `${origin}${OAUTH_ISSUER_PATH}/complete`);
  const response = NextResponse.redirect(google);
  response.cookies.set(MCP_AUTHZ_COOKIE, pending, authCookieOptions(REQUEST_TTL_SECONDS));
  return response;
}
