/**
 * POST /api/mcp/oauth/token: exchange an authorization code (with its PKCE verifier) or a refresh
 * token for an access + refresh pair.
 *
 * A code is honoured only by the client it was issued to, at the redirect URI it was issued for,
 * with the verifier matching its challenge. A refresh is honoured only while the Google connection it
 * names still exists: once a user disconnects Google, their MCP clients are told to sign in again
 * here, instead of receiving fresh tokens that every tool call would then reject.
 */
import { getTokenStore } from '@/lib/token-store';
import { oauthSecret } from '@/mcp/oauth/config.js';
import {
  clientKey,
  issueTokens,
  readClient,
  readCode,
  readGrant,
  verifyPkce,
} from '@/mcp/oauth/grants.js';
import { oauthError, oauthJson } from '@/mcp/oauth/http.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const secret = oauthSecret();
  if (secret === null) return new Response('Not found', { status: 404 });

  const form = new URLSearchParams(await request.text());
  const clientId = form.get('client_id');
  if (clientId === null || readClient(clientId, secret) === null) {
    return oauthError(401, 'invalid_client', 'Unknown client');
  }
  const cid = clientKey(clientId);
  const grantType = form.get('grant_type');

  if (grantType === 'authorization_code') {
    const code = readCode(form.get('code'), secret);
    const redirectUri = form.get('redirect_uri');
    if (
      code === null ||
      code.cid !== cid ||
      (redirectUri !== null && redirectUri !== code.redirectUri) ||
      !verifyPkce(form.get('code_verifier'), code.challenge)
    ) {
      return oauthError(400, 'invalid_grant', 'The authorization code is invalid or has expired');
    }
    const resource = form.get('resource');
    if (resource !== null && code.resource !== undefined && resource !== code.resource) {
      return oauthError(400, 'invalid_target', 'resource does not match the authorization request');
    }
    return oauthJson(
      issueTokens(
        { sub: code.sub, cid, ...(code.resource !== undefined ? { resource: code.resource } : {}) },
        secret,
      ),
    );
  }

  if (grantType === 'refresh_token') {
    const grant = readGrant('refresh', form.get('refresh_token'), secret);
    if (grant === null || grant.cid !== cid) {
      return oauthError(400, 'invalid_grant', 'The refresh token is invalid or has expired');
    }
    if ((await getTokenStore().get(grant.sub)) === null) {
      return oauthError(400, 'invalid_grant', 'The Google connection was removed. Sign in again.');
    }
    return oauthJson(issueTokens(grant, secret));
  }

  return oauthError(400, 'unsupported_grant_type', 'Use authorization_code or refresh_token');
}
