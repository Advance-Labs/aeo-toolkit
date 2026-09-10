/**
 * GET /api/auth/google/callback — finish the OAuth flow.
 *
 * Verifies the CSRF `state` cookie, exchanges the authorization `code` for tokens, persists them in
 * the {@link TokenStore} keyed by the user-id cookie, then redirects back to the page the flow
 * started on (the return cookie, re-validated) with `?connected=1` or `?error=<reason>`. Every
 * outcome lands there, so the page can say what happened. Node runtime only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createOAuth, STATE_COOKIE, USER_COOKIE } from '@/lib/oauth';
import { getTokenStore } from '@/lib/token-store';
import { MissingEnvError } from '@/lib/google-env';
import {
  allowedReturnOrigins,
  authCookieOptions,
  resolveReturnTo,
  RETURN_COOKIE,
  withAuthResult,
  type AuthResult,
} from '@/lib/oauth-return';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Google's `error` param is attacker-controllable; only pass through plain error codes. */
function safeCode(raw: string): string {
  return /^[a-z_]{1,64}$/.test(raw) ? raw : 'oauth_error';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const cookieStore = await cookies();
  // Our own start route wrote this cookie, but it still becomes a Location header: validate again.
  const returnTo = resolveReturnTo(
    cookieStore.get(RETURN_COOKIE)?.value,
    allowedReturnOrigins(url.origin),
    url.origin,
  );

  const finish = (result: AuthResult): NextResponse => {
    if ('error' in result) console.warn(`[oauth] callback failed: ${result.error}`);
    const response = NextResponse.redirect(withAuthResult(returnTo, result));
    // One-time cookies: consumed on success, and useless after any failure.
    response.cookies.set(STATE_COOKIE, '', authCookieOptions(0));
    response.cookies.set(RETURN_COOKIE, '', authCookieOptions(0));
    return response;
  };

  if (oauthError) return finish({ error: safeCode(oauthError) });
  if (!code || !state) return finish({ error: 'missing_code' });

  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const userId = cookieStore.get(USER_COOKIE)?.value;

  if (!expectedState || expectedState !== state) return finish({ error: 'state_mismatch' });
  if (!userId) return finish({ error: 'no_session' });

  let oauth;
  try {
    oauth = createOAuth();
  } catch (err) {
    const reason = err instanceof MissingEnvError ? err.variable : 'config';
    return finish({ error: `server_${reason}` });
  }

  try {
    const tokens = await oauth.exchangeCode(code);
    await getTokenStore().set(userId, tokens);
  } catch (err) {
    // Log server-side so a failed exchange is diagnosable; never leak internals to the client.
    console.error('[oauth] token exchange failed:', err instanceof Error ? err.message : String(err));
    return finish({ error: 'exchange_failed' });
  }

  return finish({ connected: true });
}
