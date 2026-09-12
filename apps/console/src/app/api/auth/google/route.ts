/**
 * GET /api/auth/google — kick off the Google OAuth consent flow.
 *
 * Mints (or reuses) an opaque user id, generates a CSRF `state` nonce, remembers where to send the
 * browser afterwards (`?return_to=`, validated by {@link resolveReturnTo}), stores all three in
 * httpOnly cookies, and redirects the browser to Google's consent screen. Node runtime only.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOAuth, randomId, STATE_COOKIE, USER_COOKIE } from '@/lib/oauth';
import { MissingEnvError } from '@/lib/google-env';
import {
  allowedReturnOrigins,
  authCookieOptions,
  resolveReturnTo,
  RETURN_COOKIE,
  withAuthResult,
} from '@/lib/oauth-return';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const returnTo = resolveReturnTo(
    url.searchParams.get('return_to'),
    allowedReturnOrigins(url.origin),
    url.origin,
  );

  let oauth;
  try {
    oauth = createOAuth();
  } catch (err) {
    // Not configured (e.g. GOOGLE_CLIENT_ID unset). Redirect back with a friendly notice instead of a
    // hard 500 — this route is also prefetched by the Connect link, so a 5xx would noise the console.
    const reason = err instanceof MissingEnvError ? 'google_not_configured' : 'oauth_error';
    return NextResponse.redirect(withAuthResult(returnTo, { error: reason }));
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value ?? randomId();
  const state = randomId();

  const response = NextResponse.redirect(oauth.getAuthUrl(state));
  response.cookies.set(USER_COOKIE, userId, authCookieOptions(60 * 60 * 24 * 30));
  response.cookies.set(STATE_COOKIE, state, authCookieOptions(60 * 10));
  response.cookies.set(RETURN_COOKIE, returnTo, authCookieOptions(60 * 10));
  return response;
}
