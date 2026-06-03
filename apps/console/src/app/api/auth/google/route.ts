/**
 * GET /api/auth/google — kick off the Google OAuth consent flow.
 *
 * Mints (or reuses) an opaque user id, generates a CSRF `state` nonce, stores both in httpOnly
 * cookies, and redirects the browser to Google's consent screen. Node runtime only.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOAuth, randomId, STATE_COOKIE, USER_COOKIE } from '@/lib/oauth';
import { MissingEnvError } from '@/lib/google-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  let oauth;
  try {
    oauth = createOAuth();
  } catch (err) {
    const message =
      err instanceof MissingEnvError
        ? `Server not configured: ${err.variable} is missing.`
        : 'Server OAuth configuration error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value ?? randomId();
  const state = randomId();

  const consentUrl = oauth.getAuthUrl(state);
  const response = NextResponse.redirect(consentUrl);

  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
