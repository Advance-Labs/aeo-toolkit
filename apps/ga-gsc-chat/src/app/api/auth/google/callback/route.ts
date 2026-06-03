/**
 * GET /api/auth/google/callback — finish the OAuth flow.
 *
 * Verifies the CSRF `state` cookie, exchanges the authorization `code` for tokens, persists them in
 * the {@link TokenStore} keyed by the user-id cookie, then redirects back to the app with a
 * `?connected=1` flag. Node runtime only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createOAuth, STATE_COOKIE, USER_COOKIE } from '@/lib/oauth';
import { getTokenStore } from '@/lib/token-store';
import { MissingEnvError } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function appOrigin(req: NextRequest): string {
  return new URL(req.url).origin;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const origin = appOrigin(req);

  if (oauthError) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const userId = cookieStore.get(USER_COOKIE)?.value;

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${origin}/?error=state_mismatch`);
  }
  if (!userId) {
    return NextResponse.redirect(`${origin}/?error=no_session`);
  }

  let oauth;
  try {
    oauth = createOAuth();
  } catch (err) {
    const reason = err instanceof MissingEnvError ? err.variable : 'config';
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(`server_${reason}`)}`);
  }

  try {
    const tokens = await oauth.exchangeCode(code);
    await getTokenStore().set(userId, tokens);
  } catch {
    // Do not leak token-exchange internals to the client.
    return NextResponse.redirect(`${origin}/?error=exchange_failed`);
  }

  const response = NextResponse.redirect(`${origin}/?connected=1`);
  // Clear the one-time CSRF state cookie now that it has been consumed.
  response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
