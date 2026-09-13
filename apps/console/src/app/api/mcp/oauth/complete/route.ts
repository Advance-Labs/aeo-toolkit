/**
 * GET /api/mcp/oauth/complete: where the Connect Google flow returns during an MCP login.
 *
 * The Google callback has already stored the user's tokens under the `aeo_session` id and appended
 * `?connected=1` or `?error=<code>`. This route turns that outcome into an authorization code (or an
 * error) on the MCP client's redirect URI, and consumes the pending-request cookie either way.
 *
 * The code names the `aeo_session` id as its subject. That is the same connection the browser's chat
 * tool uses, so connecting Google once serves both.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { USER_COOKIE } from '@/lib/oauth';
import { authCookieOptions } from '@/lib/oauth-return';
import { getTokenStore } from '@/lib/token-store';
import { issuerFor, MCP_AUTHZ_COOKIE, oauthSecret, requestOrigin } from '@/mcp/oauth/config.js';
import { issueCode, readPending } from '@/mcp/oauth/grants.js';
import { withParams } from '@/mcp/oauth/http.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const secret = oauthSecret();
  if (secret === null) return new Response('Not found', { status: 404 });

  const consume = (response: Response): Response => {
    if (response instanceof NextResponse) {
      response.cookies.set(MCP_AUTHZ_COOKIE, '', authCookieOptions(0));
    }
    return response;
  };

  const pending = readPending(request.cookies.get(MCP_AUTHZ_COOKIE)?.value, secret);
  if (pending === null) {
    const response = new NextResponse(
      'This sign-in expired or was already used. Start it again from your MCP client.',
      { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
    return consume(response);
  }

  const back = (params: Record<string, string>): Response =>
    consume(NextResponse.redirect(withParams(pending.redirectUri, { ...params, state: pending.state })));

  const q = request.nextUrl.searchParams;
  const googleError = q.get('error');
  if (googleError !== null) {
    // The callback already reduced this to a plain code (`safeCode`); `access_denied` = user cancelled.
    return back({
      error: googleError === 'access_denied' ? 'access_denied' : 'server_error',
      error_description: `Connecting Google failed: ${googleError}`,
    });
  }
  if (q.get('connected') !== '1') {
    return back({ error: 'server_error', error_description: 'Connecting Google did not complete' });
  }

  const userId = request.cookies.get(USER_COOKIE)?.value;
  if (userId === undefined || (await getTokenStore().get(userId)) === null) {
    return back({ error: 'server_error', error_description: 'No Google connection was stored' });
  }

  const code = issueCode(
    {
      sub: userId,
      cid: pending.cid,
      redirectUri: pending.redirectUri,
      challenge: pending.challenge,
      ...(pending.resource !== undefined ? { resource: pending.resource } : {}),
    },
    secret,
  );
  return back({ code, iss: issuerFor(requestOrigin(request)) });
}
